import dotenv from 'dotenv';
import got from 'got';
import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const seedFromLocalAndS3Combined = async () => {
  const mongoUri = process.env.SPACEX_MONGO;
  if (!mongoUri) {
    console.error('Error: SPACEX_MONGO environment variable is missing.');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log('Connecting directly to MongoDB instance...');
    await client.connect();
    const db = client.db();

    // 1. Read the full-specification rockets data from your OWN repository
    console.log('Reading full-specification rockets data from repository disk...');
    const localRocketsPath = path.resolve(process.cwd(), 'rocketsData.json');
    
    if (!fs.existsSync(localRocketsPath)) {
      throw new Error('Critical Error: rocketsData.json file was not found in the repository root folder.');
    }
    
    const rawRocketsData = fs.readFileSync(localRocketsPath, 'utf8');
    const richRockets = JSON.parse(rawRocketsData);

    // 2. Fetch the working historical launches file from S3
    console.log('Streaming production launches dataset from IBM S3...');
    const launches = await got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json();
    
    if (!launches || !Array.isArray(launches)) {
      throw new Error('Invalid or empty launch backup payload received.');
    }

    // 3. Format everything cleanly with strict MongoDB ObjectIds
    const formattedRockets = richRockets.map(r => {
      if (r.id) r._id = new ObjectId(r.id);
      return r;
    });

    const formattedLaunches = launches.map(l => {
      if (l._id) l._id = new ObjectId(l._id);
      if (typeof l.rocket === 'string' && ObjectId.isValid(l.rocket)) l.rocket = new ObjectId(l.rocket);
      if (typeof l.launchpad === 'string' && ObjectId.isValid(l.launchpad)) l.launchpad = new ObjectId(l.launchpad);
      return l;
    });

    // 4. Wipe and seed your collections
    console.log('Wiping out old collections...');
    await db.collection('launches').deleteMany({});
    await db.collection('rockets').deleteMany({});

    console.log('Injecting high-fidelity records into MongoDB...');
    await db.collection('launches').insertMany(formattedLaunches);
    await db.collection('rockets').insertMany(formattedRockets);

    console.log('🚀 MASTER SEED COMPLETELY SUCCESSFUL WITH FULL TECH SPECS!');
  } catch (error) {
    console.error('Seeding process failed:', error.message);
  } finally {
    await client.close();
    console.log('Database connection closed safely.');
  }
};

seedFromLocalAndS3Combined();
