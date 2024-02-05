require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(
  cors()
  // {
  //   origin: ["http://localhost:5173"],
  //   credentials: true,
  // }
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@try-myself.0cjln25.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    // Database Collection
    const userCollection = client.db("Gym").collection("Users");
    const classCollection = client.db("Gym").collection("manageClasses");
    const membershipCollection = client.db("Gym").collection("PaidMember");
    const paymentCollectin = client.db("Gym").collection("paymentCollection");

    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);

      if (!req.headers.authorization) {
        return res.status(401).send({
          message: "Forbidden Access",
        });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" });
        }

        req.decoded = decoded;
        next();
      });
    };
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // JWT related APi
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Class Related Apis
    app.get("/manageClasses", async (req, res) => {
      const query = req.body;
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/manageClass", async (req, res) => {
      const user = req.body;
      const result = await classCollection.insertOne(user);
      res.send(result);
    });
    // Users related APi
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // Paid MemberShip User Api
   

    // Show Users From the DB To All User Admin Dashboard
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // Delete Users Data from the DB
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Making Admin Or Other Role Update
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Payment Related Api

    app.post("/create-payment-intent",  async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount Error");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const query = {email: payment.email}
      const existingUser = await paymentCollectin.findOne(query);
      if(existingUser){
        return res.send({message: "This Email Owner is an member Already"})

      }
      const result = await paymentCollectin.insertOne(payment)
      res.send(result);
    });

    app.get("/payments", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await paymentCollectin.find().toArray();
      res.send(result);
    });



    // User Email verify

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Server is Running");
});
app.listen(port, () => {
  console.log(`Gym is running on port ${port}`);
});
