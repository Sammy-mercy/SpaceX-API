import dotenv from 'dotenv';
import got from 'got';
import { MongoClient } from 'mongodb';

dotenv.config();

const clearAndSeedNative = async () => {
  // Use the exact environment variable your application expects
  const mongoUri = process.env.SPACEX_MONGO;

  if (!mongoUri) {
    console.error('Error: SPACEX_MONGO environment variable is missing.');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log('Connecting directly to MongoDB instance...');
    await client.connect();
    
    // Extract database name dynamically from connection string, or default to admin/test
    const db = client.db(); 
    const launchesCollection = db.collection('launches');

    console.log('Downloading pristine SpaceX backup snapshot...');
    const response = await got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json();
    
    if (!response || !Array.isArray(response)) {
      throw new Error('Invalid or empty backup data payload received.');
    }

    console.log('Clearing old launches collection...');
    await launchesCollection.deleteMany({});

    console.log(`Injecting ${response.length} documents directly into MongoDB...`);
    await launchesCollection.insertMany(response);

    console.log('🚀 DATABASE POPULATED SUCCESSFULLY WITH ALL HISTORICAL DATA!');
  } catch (error) {
    console.error('Native seeding script failed:', error.message);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
};

clearAndSeedNative();
