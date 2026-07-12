import dotenv from 'dotenv';
import got from 'got';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const seedFromOfficialProductionBackup = async () => {
  const mongoUri = process.env.SPACEX_MONGO;
  if (!mongoUri) {
    console.error('Error: SPACEX_MONGO environment variable is missing.');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log('Connecting to MongoDB instance...');
    await client.connect();
    const db = client.db();

    // Base URL pointing to the official r/SpaceX open-source document storage tree
    const githubDataUrl = 'https://raw.githubusercontent.com/r-spacex/SpaceX-API/master/data';

    const endpoints = [
      { name: 'launches', path: 'launches.json' },
      { name: 'rockets', path: 'rockets.json' },
      { name: 'launchpads', path: 'launchpads.json' },
      { name: 'landpads', path: 'landpads.json' },
      { name: 'capsules', path: 'capsules.json' },
      { name: 'cores', path: 'cores.json' },
      { name: 'roadster', path: 'roadster.json' }
    ];

    for (const target of endpoints) {
      console.log(`Streaming production layout for: [${target.name}]...`);
      const rawData = await got.get(`${githubDataUrl}/${target.path}`).json();
      
      const dataArray = Array.isArray(rawData) ? rawData : [rawData];

      // Convert ID properties to real ObjectIds so Mongoose models find them
      const processedData = dataArray.map(doc => {
        if (doc._id) doc._id = new ObjectId(doc._id);
        if (doc.id && !doc._id) doc._id = new ObjectId(doc.id);
        
        // Resolve cross-collection structural string IDs to ObjectIds
        if (typeof doc.rocket === 'string' && ObjectId.isValid(doc.rocket)) doc.rocket = new ObjectId(doc.rocket);
        if (typeof doc.launchpad === 'string' && ObjectId.isValid(doc.launchpad)) doc.launchpad = new ObjectId(doc.launchpad);
        
        return doc;
      });

      if (processedData.length > 0) {
        const collection = db.collection(target.name);
        await collection.deleteMany({});
        await collection.insertMany(processedData);
        console.log(`✅ Populated ${processedData.length} full-spec items into [${target.name}]`);
      }
    }

    console.log('🚀 DATABASE INFRASTRUCTURE FULLY RECOVERY POPULATED FROM GITHUB!');
  } catch (error) {
    console.error('Production mirror seed failed:', error.message);
  } finally {
    await client.close();
  }
};

seedFromOfficialProductionBackup();
