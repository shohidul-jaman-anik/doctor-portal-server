const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000

// middlewhare
app.use(cors())
app.use(express())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.c9w80.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const ServicesCollection = client.db("doctor-portal").collection("services");
        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = ServicesCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello From  Doctors Auncle!')
})

app.listen(port, () => {
    console.log(`Doctor portal app listening on port ${port}`)
})