const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const dotenv = require('dotenv')
dotenv.config();

const app = express();
const PORT =  5000; 
console.log("port",PORT)
 
const JWT_SECRET = 'ajf3948fF@3faDKf4_#fasdFS@KFslfjsDF!ksjlfd'; 
; 

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json()); 

// MongoDB connection
mongoose.connect('mongodb+srv://codev7127:Aryan12345678@cluster0.iprz9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Could not connect to MongoDB', err));

// User Schema and Model
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  ratings: [
    {
      courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // Reference to the Course
      rating: { type: Number, required: true, min: 1, max: 5 } // User's rating for the course
    }
  ]
});

const User = mongoose.model('User', UserSchema);

// Course Schema and Model
const CourseSchema = new mongoose.Schema({
  name: String,
  description: String,
  CourseUrl: String,
  courseType: String,
  imgUrl: String,

});

const Course = mongoose.model('Course', CourseSchema);

// Sign-Up Route
app.post('/api/signup', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Create new user
    user = new User({
      email,
      password: await bcrypt.hash(password, 10), // Hash the password
    });

    await user.save();

    // Generate JWT token
    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login Route
app.post('/api/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Generate JWT token
    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Middleware for checking JWT tokens
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};


app.get('/api/courses/:courseId?', async (req, res) => {
  try {
      const { courseId } = req.params;

      if (courseId) {
          
          if (!mongoose.Types.ObjectId.isValid(courseId)) {
              return res.status(400).json({ message: 'Invalid course ID' });
          }

          const course = await Course.findById(courseId);
          if (!course) {
              return res.status(404).json({ message: 'Course not found' });
          }

          res.json(course);
      } else {
          
          const courses = await Course.find();
          res.json(courses);
      }
  } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
  }
});


// Public Route (add new courses, no authentication required)
app.post('/api/courses', async (req, res) => {
  const course = new Course(req.body);
  await course.save();
  res.json(course);
});
app.post('/api/courses/:courseId/rate', authMiddleware,  async (req, res) => {
  const { courseId } = req.params;
  const { rating } = req.body;
  const userId = req.user.id; // Extract user ID from JWT

  try {
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if the user already rated this course
    const existingRating = user.ratings.find(r => r.courseId.toString() === courseId);
    
    if (existingRating) {
      // Update the existing rating
      existingRating.rating = rating;
    } else {
      // Add a new rating
      user.ratings.push({ courseId, rating });
    }

    await user.save();
    res.json({ msg: 'Rating added/updated successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
app.get('/api/courses/:courseId/average-rating', async (req, res) => {
  const { courseId } = req.params;

  try {
    // Fetch all users who rated this course
    const users = await User.find({ 'ratings.courseId': courseId });

    // Calculate the average rating
    const totalRatings = users.reduce((sum, user) => {
      const rating = user.ratings.find(r => r.courseId.toString() === courseId).rating;
      return sum + rating;
    }, 0);

    const averageRating = users.length > 0 ? totalRatings / users.length : 0;
    
    res.json({ averageRating });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

