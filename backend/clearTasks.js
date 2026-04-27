const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Task = require('./models/Task');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/resource-allocation';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Clearing existing tasks...');
    await Task.deleteMany({});
    console.log('✅ All tasks cleared successfully!');
    console.log('You can now start your server (npm run dev). The auto-seeder will detect 0 tasks and insert the new local and global seed data.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
