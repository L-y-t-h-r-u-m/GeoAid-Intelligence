/**
 * One-shot migration: fixes Task documents that were created before the
 * urgency→priority mapping was corrected.  Derives the right priority from
 * urgencyScore / category and saves it back.
 *
 * Run with:  node backend/scripts/fixTaskPriorities.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Task = require('../models/Task');

function derivePriority(task) {
  // If already set to something other than the schema default, trust it
  if (task.priority && task.priority !== 'Medium') return task.priority;

  const score = task.urgencyScore;
  if (score >= 5) return 'Critical';
  if (score >= 4) return 'High';
  if (score >= 3) return 'Medium';
  if (score >= 1) return 'Low';

  const cat = (task.category || '').toLowerCase();
  if (['emergency', 'medical'].includes(cat)) return 'Critical';
  if (['logistics', 'water', 'food'].includes(cat)) return 'High';
  if (['infrastructure', 'shelter'].includes(cat)) return 'Medium';

  return 'Low';
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const tasks = await Task.find({});
  let updated = 0;

  for (const task of tasks) {
    const correct = derivePriority(task);
    if (task.priority !== correct) {
      task.priority = correct;
      await task.save();
      updated++;
      console.log(`  Fixed "${task.title}" → ${correct}`);
    }
  }

  console.log(`\nDone. ${updated} task(s) updated out of ${tasks.length} total.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
