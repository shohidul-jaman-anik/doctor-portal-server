const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const { restart } = require('nodemon');
const port = process.env.PORT || 5000

// middlewhare
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.c9w80.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const ServicesCollection = client.db("doctor-portal").collection("services");
        const BookingCollection = client.db("doctor-portal").collection("Booking");
        // const BookingCollection = client.db("doctor-portal").collection("bookings");
        // console.log(BookingCollection)

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = ServicesCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = {
                treatment: booking.treatment,
                date: booking.date,
                userName: booking.userName
            }
            const exists = await BookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }

            const result = await BookingCollection.insertOne(booking)
            return res.send({ success: true, result })
        })

        app.get('/booking', async (req, res) => {
            const userEmail = req.query.userEmail;
            const query = { userEmail: userEmail };
            const bookings = await BookingCollection.find(query).toArray();
            res.send(bookings)
        })

        // app.post('/booking', async (req, res) => {
        //     const booking = req.body;
        //     console.log(booking)
        //     const result = await BookingCollection.insertOne(booking);
        //     return res.send(result)
        // })

        // Warning: This is not the proper way to query multiple collection. 
        // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // step 1:  get all services
            const services = await ServicesCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await BookingCollection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // step 5: select slots for the service Bookings: ['', '', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });


            res.send(services);
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