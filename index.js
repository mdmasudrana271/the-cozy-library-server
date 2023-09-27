const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// middleware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8tifwil.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const usersCollection = client.db("the-cozy-library").collection("users");
    const productsCollection = client.db("the-cozy-library").collection("products");
    const categoryCollection = client.db("the-cozy-library").collection("categories");
    const bookingCollection = client.db("the-cozy-library").collection("booking");
    const paymentsCollection = client.db("the-cozy-library").collection("payments");
    const reportedCollection = client.db("the-cozy-library").collection("reported");
    const authorsCollection = client.db("the-cozy-library").collection("authors");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user.role !== "Admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user.role !== "Seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = usersCollection.insertOne(user);
      res.send(result);
    });

    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.post("/bookings", verifyJWT, async (req, res) => {
      const order = req.body;
      const result = await bookingCollection.insertOne(order);
      res.send(result);
    });

    app.post('/report-product', verifyJWT, async(req, res)=>{
        const product = req.body;
      const result = await reportedCollection.insertOne(product);
      res.send(result);
    })

    app.get('/report-product', verifyJWT, verifyAdmin, async(req, res)=>{
        const query = {}
        const result = await reportedCollection.find(query).toArray();
        res.send(result)
    })

    app.delete("/report-product/:id", verifyJWT, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(filter);
        res.send(result);
      });

    app.patch("/advertise/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          advertise: "true",
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.patch("/products/:product", verifyJWT, async (req, res) => {
      const name = req.params.product;
      const filter = { name: name };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "Sold",
          advertise: false,
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
      console.log(filter);
    });

    app.patch(
      "/verify-seller/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            verified: "true",
          },
        };
        const result = await usersCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      }
    );

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "Admin" });
    });

    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === "Seller" });
    });

    app.get("/category", async (req, res) => {
      const query = {};
      const categories = await categoryCollection.find(query).toArray();
      res.send(categories);
    });

    app.get("/products", async (req, res) => {
      const id = req.query.id;
      const category = await categoryCollection.findOne({ _id: ObjectId(id) });
      const data = await productsCollection.find({ category: category.name }).toArray();
      res.send(data);
    });

    app.get("/my-products", verifyJWT, verifySeller, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await productsCollection.find(query).sort({ $natural: -1 }).toArray();
      res.send(result);
    });

    app.delete(
      "/my-products/:id", verifyJWT,  verifySeller,  async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const result = await productsCollection.deleteOne(filter);
        res.send(result);
      }
    );

    app.delete("/my-seller/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.delete("/my-buyer/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/my-orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await bookingCollection.find(query).sort({ $natural: -1 }).toArray();
      res.send(result);
    });

    app.get("/my-orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    app.get("/ads-products", async (req, res) => {
      const query = { advertise: "true" };
      const result = await productsCollection.find(query).sort({ $natural: -1 }).toArray();
      res.send(result);
    });

    app.get("/seller", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      const result = users.filter((user) => user.role === "Seller");
      res.send(result);
    });

    app.get("/buyers", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      const result = users.filter((user) => user.role === "Buyer");
      res.send(result);
    });
    app.get("/customers", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      const result = users.filter((user) => user.role === "Buyer").slice(0, 8);
      res.send(result);
    });
    app.get("/authors", async (req, res) => {
      const query = {};
      const users = await authorsCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/user-status",verifyJWT, async (req, res) => {
      const name = req.query.name;
      const query = { name: name };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
  } finally {
  }
}

run().catch((error) => {
  console.log(error.message);
});

app.get("/", (req, res) => {
  res.send("the cozy library server running");
});

app.listen(port, () => {
  console.log(`i am running on port ${port}`);
});
