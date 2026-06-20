const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT || 8000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_DB_URI;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db('fitpulse');
    const userCollection = db.collection('user');
    const classCollection = db.collection('classes');
    const bookingCollection = db.collection('bookings');
    const favoriteCollection = db.collection('favorites');
    const forumPostCollection = db.collection('forumPosts');
    const trainerApplicationCollection = db.collection('trainerApplications');

    //trainer class add
    app.post('/api/trainer', async (req, res) => {
      const {
        title,
        email,
        coverImage,
        category,
        difficulty,
        duration,
        price,
        schedule,
        startTime,
        description,
      } = req.body;

      const addData = {
        title,
        email,
        coverImage,
        category,
        difficulty,
        duration,
        price,
        schedule,
        startTime,
        description,
        createdAt: new Date(),
      };
      const result = await classCollection.insertOne(addData);
      res.send(result);
    });

    app.post('/api/forumpost', async (req, res) => {
      const {
        title,
        authorEmail,
        authorName,
        role,
        category,
        image,
        description,
      } = req.body;
      const addData = {
        title,
        description,
        category,
        image,
        authorName,
        authorEmail,
        role,
        createdAt: new Date(),
        likes: [],
        dislikes: [],
        commentCount: [],
      };
      const result = await forumPostCollection.insertOne(addData);
      res.send(result);
    });

    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
