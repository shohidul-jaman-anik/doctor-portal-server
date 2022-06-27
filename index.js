const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { restart } = require('nodemon');
const port = process.env.PORT || 5000

// middlewhare
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.c9w80.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {
    try {
        await client.connect();

        const ServicesCollection = client.db("doctor-portal").collection("services");
        const BookingCollection = client.db("doctor-portal").collection("Booking");
        const userCollection = client.db("doctor-portal").collection("user");
        const ReviewCollection = client.db("doctor-portal").collection("reviews");
        const DoctorCollection = client.db("doctor-portal").collection("doctor");
        const paymentsCollection = client.db("doctor-portal").collection("payments");

        // get all services from database
        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = ServicesCollection.find(query).project({name:1})
            const result = await cursor.toArray()
            res.send(result)
        })

        // Post database  booking information
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

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query?.patient;
            const decodedEmail = req.decoded.email
            if (patient == decodedEmail) {
                const query = { patient: patient };
                const bookings = await BookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: "forbiden access" })
            }

        })

        // find a particular booking for payment
        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const booking = await BookingCollection.findOne(query)
            res.send(booking)
        })


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

        // get all user
        app.get('/allUsers', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })


        // Save Registered user information store in the database
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, option)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET)
            res.send({ result, token })
        })

        // Make a admin
        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // Delete User
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await userCollection.deleteOne(filter)
            res.send(result)
        })

        // get all admin for  protected route
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === "admin"
            res.send({ admin: isAdmin })
        })

        // delete order item
        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id
            console.log(id)
            const query = { _id: ObjectId(id) }
            console.log(query)
            const result = await BookingCollection.deleteOne(query)
            res.send(result)
        })

        // -------------------------
        //  Review 
        //---------------------------- 

        // post  review
        app.post('/review', async (req, res) => {
            const review = req.body
            const result = await ReviewCollection.insertOne(review)
            res.send(result)
        })
        // get all reviews
        app.get('/reviews', async (req, res) => {
            const query = {}
            const cursor = ReviewCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // -------------------------
        //  Doctor
        //---------------------------- 

        app.post('/doctors',verifyJWT, async (req, res) => {
            const doctor = req.body
            const result = await DoctorCollection.insertOne(doctor)
            res.send(result)
        })




        // -------------------------
        //  Payment 
        //---------------------------- 

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentsCollection.insertOne(payment);
            const updatedBooking = await BookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
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