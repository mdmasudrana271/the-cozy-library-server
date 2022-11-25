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


async function run(){
    try{
        const usersCollection = client.db('the-cozy-library').collection("users")
        const productsCollection = client.db('the-cozy-library').collection("products")
        const categoryCollection = client.db('the-cozy-library').collection("categories")

        app.post('/users', async(req, res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/products', async(req, res)=>{
            const product = req.body;
            const result = await productsCollection.insertOne(product)
            res.send(result)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            console.log(user)
            res.send({ isAdmin: user?.role === 'Admin' });
        })
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            console.log(user)
            res.send({ isSeller: user?.role === 'Seller' });
        })
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            console.log(user)
            res.send({ isBuyer: user?.role === 'Buyer'});
        })

        app.get('/category', async(req, res)=>{
            const query = {}
            const categories = await categoryCollection.find(query).toArray()
            res.send(categories)
        })
       
        app.get('/products', async(req, res)=>{
            // const id = req.params.id;
            const id = req.query.name;
            console.log(id)
            const category = await categoryCollection.findOne({_id: ObjectId(id)})
            const data = await productsCollection.find({category: category.name}).toArray()
            
            res.send(data)
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