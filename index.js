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

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error(error);
  }
}
connectDB();

const db = client.db('fitpulse');
const userCollection = db.collection('user');
const classCollection = db.collection('classes');
const bookingCollection = db.collection('bookings');
const favoriteCollection = db.collection('favorites');
const forumPostCollection = db.collection('forumPosts');
const trainerApplicationCollection = db.collection('trainerApplications');

// add class
app.post('/api/trainer', async (req, res) => {
  const {
    className,
    authorName,
    authorEmail,
    authorImage,
    authorRole,
    coverImage,
    category,
    difficulty,
    duration,
    price,
    schedule,
    startTime,
    description,
    status,
    totalEnrollment,
    capacity,
    createdAt,
  } = req.body;

  const addData = {
    className,
    authorName,
    authorEmail,
    authorImage,
    authorRole,
    coverImage,
    category,
    difficulty,
    duration,
    price,
    schedule,
    startTime,
    description,
    status,
    totalEnrollment,
    capacity,
    createdAt,
  };
  const result = await classCollection.insertOne(addData);
  res.send(result);
});

// get all classes
app.get('/api/classes', async (req, res) => {
  const result = await classCollection.find({}).toArray();
  res.send(result);
});

// get class by id or email
app.get('/api/classes/:identifier', async (req, res) => {
  const identifier = req.params.identifier;
  try {
    if (ObjectId.isValid(identifier)) {
      const result = await classCollection.findOne({
        _id: new ObjectId(identifier),
      });
      res.send(result);
    } else {
      const result = await classCollection
        .find({
          $or: [{ email: identifier }, { authorEmail: identifier }],
        })
        .toArray();
      res.send(result);
    }
  } catch (error) {
    res.status(500).send({ error: true, message: error.message });
  }
});

// delete class by id
app.delete('/api/classes/:id', async (req, res) => {
  const id = req.params.id;
  const result = await classCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

// update class by id
app.patch('/api/classes/:id', async (req, res) => {
  const id = req.params.id;
  const updatedClassData = req.body;

  const result = await classCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedClassData },
  );
  res.send(result);
});

// get all forum posts
app.get(['/api/forum-post', '/api/forum-posts'], async (req, res) => {
  const result = await forumPostCollection.find({}).toArray();
  res.send(result);
});

// get forum post by pagination
app.get('/api/forum-posts-paginate', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const result = await forumPostCollection
    .find({})
    .skip(skip)
    .limit(Number(limit))
    .toArray();

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

// edit forum post by id
app.patch('/api/forum-post/:id', async (req, res) => {
  const id = req.params.id;
  const updatedForumPostData = req.body;

  const result = await forumPostCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedForumPostData },
  );
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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.exports = app;
