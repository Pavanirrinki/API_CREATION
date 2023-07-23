
const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const axios = require("axios")
const bodyParser = require('body-parser');


const app = express()
app.use(cors({
    origin: "*"
}))
app.use(express.json());
mongoose.set('strictQuery', false);
mongoose.connect("mongodb+srv://pavanirrinki0123:pavanirrinki0123@cluster0.n9jmaks.mongodb.net/?retryWrites=true&w=majority"
    , { useNewUrlParser: true, useUnifiedTopology: true }).then
    (() => console.log("DB CONNECTED8"))

const schemadata = new mongoose.Schema({
    title: {
        type: String,
    },
    price: {
        type: String,
    },
    description: {
        type: String,
    },
    category: {
        type: String,
    },
    image: {
        type: String,
    },
    sold: {
        type: Boolean,
    },
    dateOfSale: {
        type: Date,
    },
})
const Data = mongoose.model("Data", schemadata);

app.post("/data-sign", async (req, res) => {
    const data = axios.get("https://s3.amazonaws.com/roxiler.com/product_transaction.json").
        then(async (response) => {
            const usersdata = response.data
            for (const item of usersdata) {
                delete item.id;
                await new Data({
                    title: item.title,
                    price: item.price,
                    description: item.description,
                    category: item.category,
                    image: item.image,
                    sold: item.sold,
                    dateOfSale: item.dateOfSale
                }).save();
            }

            res.status(200).json(response.data)
        })
})

//API FOR TOTAL-SALES-IN A MONTH OF ALL YEARS AND TOTAL SALES AND NOT SALED COUNT
app.get("/total-sale-amount/:month", async (req, res) => {
    const { month } = req.params;
 try {
 const totalSaleAmount = await Data.aggregate([
            {
            $match: {
                    sold: true,
                    $expr: {
                      $eq: [{ $month: "$dateOfSale" }, parseInt(month)],
                           },
                  }
            },
            {
            $group: {
                    _id: { $year: "$dateOfSale" },
                    totalAmount: { $sum: { $toDouble: "$price" } },
                },
            },
        ]);
 const totalSoldItems = await Data.aggregate([
            {
                $match: {
                    sold: true,
                    $expr: 
                    {$eq: [{ $month: "$dateOfSale" }, parseInt(month)] ,
                }
                },
            },
            {
                $group: {
                    _id: null,
                    totalSoldItems: { $sum: 1 },
                },
            },
        ]);
const totalNotSoldItems = await Data.aggregate([
            {
                $match: {
                    sold: false,
                    $expr: {
                         $eq: [{ $month: "$dateOfSale" }, parseInt(month)] ,
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalNotSoldItems: { $sum: 1 },
                },
            },
        ]);

        res.status(200).json({
            totalSaleAmount,
            totalSoldItems: totalSoldItems[0] ? totalSoldItems[0].totalSoldItems : 0,
            totalNotSoldItems: totalNotSoldItems[0] ? totalNotSoldItems[0].totalNotSoldItems : 0,
        });
    } catch (error) {
        res.status(500).json(error.message);
    }
});


//BAR GRAPH OF EVERY YEAR OF SELECTED MONTH WITH PRICE RANGE AND COUNT OF SALES
app.get('/api/bar-chart-data/:selectedMonth', async (req, res) => {
    try {
        const { selectedMonth } = req.params;
        const priceRanges = [
            { min: 0, max: 100 },
            { min: 101, max: 200 },
            { min: 201, max: 300 },
            { min: 301, max: 400 },
            { min: 401, max: 500 },
            { min: 501, max: 600 },
            { min: 601, max: 700 },
            { min: 701, max: 800 },
            { min: 801, max: 900 },
            { min: 901, max: Number.MAX_SAFE_INTEGER },
        ];

        const items = await Data.aggregate([
            {
                $project: {
                    month: { $month: { date: '$dateOfSale' } },
                    year: { $year: { date: '$dateOfSale' } },
                    price: 1,
                },
            },
            {
                $match: {
                    month: parseInt(selectedMonth) + 1,
                },
            },
        ]);

        const priceRangeCounts = Array(priceRanges.length).fill(0);

        items.forEach((item) => {
            const { price } = item;
            for (let i = 0; i < priceRanges.length; i++) {
                if (price >= priceRanges[i].min && price <= priceRanges[i].max) {
                    priceRangeCounts[i]++;
                    break;
                }
            }
        });

        const response = priceRanges.map((range, index) => ({
            priceRange: `${range.min}-${range.max}`,
            count: priceRangeCounts[index],
        }));

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


//PIE-CHART-DATA
app.get('/api/pie-chart-data/:selectedMonth', async (req, res) => {
    try {
        const { selectedMonth } = req.params;
        console.log(selectedMonth)
        const pipeline = [
            {
                $project: {
                    month: { $month: { date: '$dateOfSale' } },
                    category: 1,
                },
            },
            {
                $match: {
                    month: parseInt(selectedMonth) + 1,
                },
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                },
            },
        ];

        const items = await Data.aggregate(pipeline);

        const response = items.map((item) => ({
            category: item._id,
            count: item.count,
        }));

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});





const endpoint1 = 'http://localhost:4010/total-sale-amount/:march';
const endpoint2 = 'http://localhost:4010/api/bar-chart-data/:selectedMonth';
const endpoint3 = 'http://localhost:4010/api/pie-chart-data/:selectedMonth';

// Define a function to fetch data from an API endpoint
const fetchData = async (url) => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        throw new Error(`Error fetching data from ${url}: ${error.message}`);
    }
};


app.get('/combined-data/:selectedMonth', async (req, res) => {
    try {
        const { selectedMonth } = req.params;
        const promises = [
            fetchData(endpoint1.replace(':march', selectedMonth)),
            fetchData(endpoint2.replace(':selectedMonth', selectedMonth)),
            fetchData(endpoint3.replace(':selectedMonth', selectedMonth)),
        ];

        const [totalSaleAmount, barChartData, pieChartData] = await Promise.all(promises);

        const combinedData = {
            totalSaleAmount: totalSaleAmount.totalSaleAmount,
            totalSoldItems: totalSaleAmount.totalSoldItems,
            totalNotSoldItems: totalSaleAmount.totalNotSoldItems,
            barChartData,
            pieChartData,
        };

        res.json(combinedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




const PORT = 4010
console.log(PORT)
app.listen(PORT, () => {
    return console.log("server running")
})











