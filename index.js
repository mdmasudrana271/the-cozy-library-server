const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config()
const app = express();

// middleware 

app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8tifwil.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next()
    })
}


async function run(){
    try{
        const usersCollection = client.db('the-cozy-library').collection("users")
        const productsCollection = client.db('the-cozy-library').collection("products")
        const categoryCollection = client.db('the-cozy-library').collection("categories")
        const bookingCollection = client.db('the-cozy-library').collection("booking")


        const verifyAdmin = async(req, res, next)=>{
            console.log(req.decoded.email)
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail}
            const user = await usersCollection.findOne(query)
            if(user.role !== 'Admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            next()
        }
        const verifySeller = async(req, res, next)=>{
            console.log(req.decoded.email)
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail}
            const user = await usersCollection.findOne(query)
            if(user.role !== 'Seller'){
                return res.status(403).send({message: 'forbidden access'})
            }
            next()
        }


        app.get('/jwt', async(req, res)=>{
            const email = req.query.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query)
            if(user){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1d'})
                return res.send({accessToken: token})
            }
            res.status(403).send({accessToken:''})
        })


        app.post('/users', async(req, res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/products',verifyJWT, async(req, res)=>{
            const product = req.body;
            const result = await productsCollection.insertOne(product)
            res.send(result)
        })

        app.post('/bookings',verifyJWT, async(req, res)=>{
            const order = req.body;
            const result = await bookingCollection.insertOne(order)
            res.send(result)
        })

        app.get('/users/admin/:email',verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'Admin' });
        })
        app.get('/users/seller/:email',verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'Seller' });
        })
        app.get('/users/buyer/:email',verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'Buyer'});
        })

        app.get('/category', async(req, res)=>{
            const query = {}
            const categories = await categoryCollection.find(query).toArray()
            res.send(categories)
        })
       
        app.get('/products', async(req, res)=>{
            const id = req.query.id;
            const category = await categoryCollection.findOne({_id: ObjectId(id)})
            const data = await productsCollection.find({category: category.name}).toArray()
            
            res.send(data)
        })

        app.get('/my-products',verifyJWT,verifySeller, async(req, res)=>{
            const email = req.query.email;
            console.log(email)
            const query = {email: email}
            const result = await productsCollection.find(query).sort({$natural: -1 }).toArray()
            res.send(result)
        })

        app.get('/orders', async(req, res)=>{
            const email = req.query.email;
            const query = {email: email}
            const result = await bookingCollection.find(query).sort({$natural: -1 }).toArray()
            res.send(result)
        })

        app.get('/users/seller',verifyJWT,verifyAdmin, async (req, res) => {
            const query = { }
            const users = await usersCollection.find(query).toArray();
            const result = users.filter(user=> user.role === 'Seller')
            res.send(result);
        })

    }
    finally{

    }
}

run().catch(error=> {
    console.log(error.message)
})



app.get('/', (req, res)=>{
    res.send('the cozy library server running')
})

app.listen(port, ()=>{
    console.log(`i am running on port ${port}`)
})