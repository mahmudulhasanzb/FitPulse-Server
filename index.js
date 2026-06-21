const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT || 8000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

    app.get(['/api/forum-post', '/api/forum-posts'], async (req, res) => {
      const result = await forumPostCollection.find({}).toArray();
      res.send(result);
    });

    // get user's forum post by user email
    app.get('/api/my-forum-post/:email', async (req, res) => {
      const email = req.params.email;
      const result = await forumPostCollection
        .find({ authorEmail: email })
        .toArray();
      res.send(result);
    });

    // get forum post by id
    app.get('/api/forum-post/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const result = await forumPostCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // delete forum post
    app.delete('/api/forum-post/:id', async (req, res) => {
      const id = req.params.id;
      const result = await forumPostCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

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

    // add forum post
    app.post('/api/forum-post', async (req, res) => {
      const {
        title,
        authorEmail,
        authorName,
        authorImage,
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
        authorImage,
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
