const mongoose = require('mongoose');
require('dotenv').config();
const Plot = require('./src/models/Plot');
const Project = require('./src/models/Project');

async function run() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected!');

  const project = await Project.findOne({}).sort({ createdAt: -1 }).lean();
  console.log('Project ID:', project._id);

  const plots = await Plot.find({ projectId: project._id }).sort({ plotNumberInt: 1 }).lean();
  console.log(`Found ${plots.length} plots:`);
  plots.forEach(p => {
    console.log(`Plot ${p.plotNumber}: W=${p.width} L=${p.length} Area=${p.areaSqft} Cent=${p.cent} | wM=${p.widthMeters} lM=${p.lengthMeters} areaM=${p.areaSqFeet} centM=${p.cents}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
