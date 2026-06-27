const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT || 8000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGO_DB_URI;
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
};

const verifyRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ msg: "Forbidden: insufficient role" });
    }
    next();
  };
};

const verifyBlocked = async (req, res, next) => {
  try {
    const user = await userCollection.findOne({ email: req.user.email });
    if (user && user.status === 'blocked') {
      return res.status(403).json({ msg: "Action restricted by Admin" });
    }
    next();
  } catch (error) {
    next();
  }
};

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
const commentCollection = db.collection('comments');
const transactionCollection = db.collection('transactions');

// ─── CLASSES ───────────────────────────────────────────────────────────────

app.post('/api/trainer', verifyToken, verifyRole('trainer', 'admin'), verifyBlocked, async (req, res) => {
  const {
    className, authorName, authorEmail, authorImage, authorRole,
    coverImage, category, difficulty, duration, price, schedule,
    startTime, description, status, totalEnrollment, capacity, createdAt,
  } = req.body;
  const addData = {
    className, authorName, authorEmail, authorImage, authorRole,
    coverImage, category, difficulty, duration, price, schedule,
    startTime, description, status, totalEnrollment, capacity, createdAt,
  };
  const result = await classCollection.insertOne(addData);
  res.send(result);
});

// GET /api/class - all classes
app.get('/api/class', async (req, res) => {
  const result = await classCollection.find({}).toArray();
  res.send(result);
});

// GET /api/classes - paginated + search by name ($regex) + filter by category ($in)
app.get('/api/classes', async (req, res) => {
  const { page = 1, limit = 10, search, category, sort } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = { status: 'Approved' };
  if (category && category !== 'ALL CLASSES') {
    const categoriesArray = category.split(',').map(c => c.trim());
    filter.category = { $in: categoriesArray.map(c => new RegExp(c, 'i')) };
  }
  if (search) {
    filter.className = { $regex: search, $options: 'i' };
  }

  const sortObj = {};
  if (sort === 'booked') {
    sortObj.totalEnrollment = -1;
  } else {
    sortObj.createdAt = -1;
  }

  const result = await classCollection
    .find(filter)
    .sort(sortObj)
    .skip(skip)
    .limit(Number(limit))
    .toArray();
  const totalData = await classCollection.countDocuments(filter);
  const totalPage = Math.ceil(totalData / Number(limit));

  res.send({ data: result, page: Number(page), totalPage });
});

// GET /api/classes/:identifier - by id or email
app.get('/api/classes/:identifier', async (req, res) => {
  const identifier = req.params.identifier;
  try {
    if (ObjectId.isValid(identifier)) {
      const result = await classCollection.findOne({ _id: new ObjectId(identifier) });
      res.send(result);
    } else {
      const result = await classCollection
        .find({ $or: [{ email: identifier }, { authorEmail: identifier }] })
        .toArray();
      res.send(result);
    }
  } catch (error) {
    res.status(500).send({ error: true, message: error.message });
  }
});

app.delete('/api/classes/:id', verifyToken, verifyRole('trainer', 'admin'), async (req, res) => {
  const id = req.params.id;
  const result = await classCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.patch('/api/classes/:id', verifyToken, verifyRole('trainer', 'admin'), async (req, res) => {
  const id = req.params.id;
  const updatedClassData = req.body;
  const result = await classCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedClassData },
  );
  res.send(result);
});

// ─── FORUM POSTS ──────────────────────────────────────────────────────────

app.get('/api/forum-posts', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const result = await forumPostCollection
    .find({})
    .sort({ createdAt: +1 })
    .skip(skip)
    .limit(Number(limit))
    .toArray();
  const totalData = await forumPostCollection.countDocuments();
  const totalPage = Math.ceil(totalData / Number(limit));
  res.send({ data: result, page: Number(page), totalPage });
});

app.get('/api/my-forum-post/:email', async (req, res) => {
  const email = req.params.email;
  const result = await forumPostCollection.find({ authorEmail: email }).toArray();
  res.send(result);
});

app.get('/api/forum-post/:id', async (req, res) => {
  const id = req.params.id;
  const result = await forumPostCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.patch('/api/forum-post/:id', verifyToken, verifyBlocked, async (req, res) => {
  const id = req.params.id;
  const updatedForumPostData = req.body;
  const result = await forumPostCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedForumPostData },
  );
  res.send(result);
});

app.delete('/api/forum-post/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const result = await forumPostCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post('/api/forum-post', verifyToken, verifyRole('trainer', 'admin'), verifyBlocked, async (req, res) => {
  const { title, authorEmail, authorName, authorImage, role, category, image, description } = req.body;
  const addData = {
    title, description, category, image, authorName, authorEmail, authorImage,
    role, createdAt: new Date(), likes: [], dislikes: [], commentCount: 0,
  };
  const result = await forumPostCollection.insertOne(addData);
  res.send(result);
});

// ─── COMMENTS ──────────────────────────────────────────────────────────────

app.post('/api/forum-post/:id/comments', verifyToken, verifyBlocked, async (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ msg: "Content is required" });
  const comment = {
    postId: new ObjectId(postId),
    userEmail: req.user.email,
    userName: req.user.name,
    userImage: req.user.picture || '',
    content,
    createdAt: new Date(),
  };
  const result = await commentCollection.insertOne(comment);
  await forumPostCollection.updateOne(
    { _id: new ObjectId(postId) },
    { $inc: { commentCount: 1 } },
  );
  res.send(result);
});

app.get('/api/forum-post/:id/comments', async (req, res) => {
  const postId = req.params.id;
  const result = await commentCollection
    .find({ postId: new ObjectId(postId) })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

app.patch('/api/comments/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { content } = req.body;
  const comment = await commentCollection.findOne({ _id: new ObjectId(id) });
  if (!comment) return res.status(404).json({ msg: "Comment not found" });
  if (comment.userEmail !== req.user.email) return res.status(403).json({ msg: "Not authorized" });
  const result = await commentCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { content } },
  );
  res.send(result);
});

app.delete('/api/comments/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const comment = await commentCollection.findOne({ _id: new ObjectId(id) });
  if (!comment) return res.status(404).json({ msg: "Comment not found" });
  if (comment.userEmail !== req.user.email) return res.status(403).json({ msg: "Not authorized" });
  const result = await commentCollection.deleteOne({ _id: new ObjectId(id) });
  await forumPostCollection.updateOne(
    { _id: comment.postId },
    { $inc: { commentCount: -1 } },
  );
  res.send(result);
});

// ─── LIKES / DISLIKES ──────────────────────────────────────────────────────

app.post('/api/forum-post/:id/like', verifyToken, verifyBlocked, async (req, res) => {
  const postId = req.params.id;
  const userEmail = req.user.email;
  const post = await forumPostCollection.findOne({ _id: new ObjectId(postId) });
  if (!post) return res.status(404).json({ msg: "Post not found" });

  const alreadyLiked = post.likes?.includes(userEmail);
  const alreadyDisliked = post.dislikes?.includes(userEmail);

  if (alreadyLiked) {
    await forumPostCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $pull: { likes: userEmail } },
    );
    return res.json({ liked: false });
  }

  const update = { $addToSet: { likes: userEmail } };
  if (alreadyDisliked) {
    update.$pull = { dislikes: userEmail };
  }
  await forumPostCollection.updateOne({ _id: new ObjectId(postId) }, update);
  res.json({ liked: true });
});

app.post('/api/forum-post/:id/dislike', verifyToken, verifyBlocked, async (req, res) => {
  const postId = req.params.id;
  const userEmail = req.user.email;
  const post = await forumPostCollection.findOne({ _id: new ObjectId(postId) });
  if (!post) return res.status(404).json({ msg: "Post not found" });

  const alreadyDisliked = post.dislikes?.includes(userEmail);
  const alreadyLiked = post.likes?.includes(userEmail);

  if (alreadyDisliked) {
    await forumPostCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $pull: { dislikes: userEmail } },
    );
    return res.json({ disliked: false });
  }

  const update = { $addToSet: { dislikes: userEmail } };
  if (alreadyLiked) {
    update.$pull = { likes: userEmail };
  }
  await forumPostCollection.updateOne({ _id: new ObjectId(postId) }, update);
  res.json({ disliked: true });
});

// ─── BOOKINGS ──────────────────────────────────────────────────────────────

app.post('/api/bookings', verifyToken, verifyBlocked, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ msg: "Forbidden: Admins cannot book classes" });
  }
  const { classId, className, trainerName, price, schedule, image } = req.body;
  const existing = await bookingCollection.findOne({
    userEmail: req.user.email,
    classId: classId,
  });
  if (existing) return res.status(400).json({ msg: "Already booked this class" });

  const booking = {
    classId,
    className,
    trainerName,
    price,
    schedule,
    image,
    userEmail: req.user.email,
    userName: req.user.name,
    status: 'confirmed',
    createdAt: new Date(),
  };
  const result = await bookingCollection.insertOne(booking);
  await classCollection.updateOne(
    { _id: new ObjectId(classId) },
    { $inc: { totalEnrollment: 1 } },
  );
  res.send(result);
});

app.get('/api/bookings/:email', async (req, res) => {
  const email = req.params.email;
  const result = await bookingCollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.get('/api/bookings/check/:classId/:email', async (req, res) => {
  const { classId, email } = req.params;
  const booking = await bookingCollection.findOne({ classId, userEmail: email });
  res.json({ booked: !!booking });
});

// ─── FAVORITES ─────────────────────────────────────────────────────────────

app.post('/api/favorites', verifyToken, verifyBlocked, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ msg: "Forbidden: Admins cannot favorite classes" });
  }
  const { classId, className, classImage } = req.body;
  const existing = await favoriteCollection.findOne({
    userEmail: req.user.email,
    classId,
  });
  if (existing) {
    await favoriteCollection.deleteOne({ _id: existing._id });
    return res.json({ favorited: false });
  }
  const fav = {
    classId,
    className,
    classImage,
    userEmail: req.user.email,
    createdAt: new Date(),
  };
  const result = await favoriteCollection.insertOne(fav);
  res.json({ favorited: true, data: result });
});

app.get('/api/favorites/:email', async (req, res) => {
  const email = req.params.email;
  const result = await favoriteCollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.delete('/api/favorites/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const result = await favoriteCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.get('/api/favorites/check/:classId/:email', async (req, res) => {
  const { classId, email } = req.params;
  const fav = await favoriteCollection.findOne({ classId, userEmail: email });
  res.json({ favorited: !!fav });
});

// ─── TRAINER APPLICATIONS ──────────────────────────────────────────────────

app.post('/api/trainer-application', verifyToken, verifyBlocked, async (req, res) => {
  const { experience, specialty } = req.body;
  const existing = await trainerApplicationCollection.findOne({
    userEmail: req.user.email,
  });
  if (existing && existing.status === 'Pending') {
    return res.status(400).json({ msg: "Application already pending" });
  }
  if (existing && existing.status === 'Approved') {
    return res.status(400).json({ msg: "You are already a trainer" });
  }
  // Allow re-apply if rejected — delete old application first
  if (existing && existing.status === 'Rejected') {
    await trainerApplicationCollection.deleteOne({ _id: existing._id });
  }

  const application = {
    userEmail: req.user.email,
    userName: req.user.name,
    userImage: req.user.picture || '',
    experience,
    specialty,
    status: 'Pending',
    feedback: '',
    createdAt: new Date(),
  };
  const result = await trainerApplicationCollection.insertOne(application);
  res.send(result);
});

app.get('/api/trainer-application/:email', async (req, res) => {
  const email = req.params.email;
  const result = await trainerApplicationCollection.findOne({ userEmail: email });
  res.send(result);
});

app.get('/api/trainer-applications', async (req, res) => {
  const result = await trainerApplicationCollection.find({}).toArray();
  res.send(result);
});

app.patch('/api/trainer-application/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  const id = req.params.id;
  const { status, feedback } = req.body;
  const application = await trainerApplicationCollection.findOne({ _id: new ObjectId(id) });
  if (!application) return res.status(404).json({ msg: "Application not found" });

  await trainerApplicationCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, feedback } },
  );

  if (status === 'Approved') {
    await userCollection.updateOne(
      { email: application.userEmail },
      { $set: { role: 'trainer' } },
    );
  }

  res.json({ msg: "Application updated" });
});

// ─── ADMIN: USERS ──────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  const result = await userCollection.find({}).toArray();
  res.send(result);
});

app.patch('/api/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const result = await userCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updates },
  );
  res.send(result);
});

// ─── ADMIN: ALL CLASSES MANAGEMENT ─────────────────────────────────────────

app.get('/api/admin/classes', async (req, res) => {
  const result = await classCollection.find({}).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

app.patch('/api/admin/classes/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const result = await classCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status } },
  );
  res.send(result);
});

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────

app.get('/api/transactions', async (req, res) => {
  const result = await transactionCollection.find({}).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

app.post('/api/transactions', async (req, res) => {
  const { userEmail, amount, currency, transactionId, classId, className } = req.body;
  const tx = { userEmail, amount, currency, transactionId, classId, className, createdAt: new Date() };
  const result = await transactionCollection.insertOne(tx);
  res.send(result);
});

// ─── DASHBOARD STATS ───────────────────────────────────────────────────────

app.get('/api/stats/admin', async (req, res) => {
  const totalUsers = await userCollection.countDocuments();
  const totalTrainers = await userCollection.countDocuments({ role: 'trainer' });
  const totalClasses = await classCollection.countDocuments();
  const totalBookings = await bookingCollection.countDocuments();
  const totalRevenue = await transactionCollection.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).toArray();
  res.send({
    totalUsers,
    totalTrainers,
    totalClasses,
    totalBookings,
    totalRevenue: totalRevenue[0]?.total || 0,
  });
});

app.get('/api/stats/student/:email', async (req, res) => {
  const email = req.params.email;
  const totalBookings = await bookingCollection.countDocuments({ userEmail: email });
  const totalFavorites = await favoriteCollection.countDocuments({ userEmail: email });
  const application = await trainerApplicationCollection.findOne({ userEmail: email });
  res.send({ totalBookings, totalFavorites, application });
});

app.get('/api/stats/trainer/:email', async (req, res) => {
  const email = req.params.email;
  const totalClasses = await classCollection.countDocuments({ authorEmail: email });
  const classes = await classCollection.find({ authorEmail: email }).toArray();
  const totalStudents = classes.reduce((sum, c) => sum + (c.totalEnrollment || 0), 0);
  res.send({ totalClasses, totalStudents });
});

// ─── ALL FORUM POSTS (ADMIN) ───────────────────────────────────────────────

app.get('/api/all-forum-posts', async (req, res) => {
  const result = await forumPostCollection.find({}).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// ─── ALL TRAINERS ──────────────────────────────────────────────────────────

app.get('/api/trainers', async (req, res) => {
  const result = await userCollection.find({ role: 'trainer' }).toArray();
  res.send(result);
});

// ─── DEMOTE TRAINER ────────────────────────────────────────────────────────

app.patch('/api/trainers/demote/:id', verifyToken, verifyRole('admin'), async (req, res) => {
  const id = req.params.id;
  const result = await userCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { role: 'student' } },
  );
  res.send(result);
});

// ─── ROOT ──────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.exports = app;
