import dotenv from 'dotenv';
import got from 'got';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const seedCompleteProductionDatabase = async () => {
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

    // A single unified, stable production data vault mirror containing ALL SpaceX histories
    console.log('Downloading complete production data vault...');
    const dataVault = await got.get('https://api.jsonbin.io/v3/b/6610667bad19ca34f855452d?meta=false').json();

    const collections = ['launches', 'rockets', 'launchpads', 'landpads', 'capsules', 'cores', 'roadster'];

    for (const colName of collections) {
      const records = dataVault[colName];
      
      if (Array.isArray(records) && records.length > 0) {
        // Format IDs to real ObjectIds so Mongoose can cross-reference everything properly
        const processedRecords = records.map(doc => {
          if (doc._id) doc._id = new ObjectId(doc._id);
          else if (doc.id && ObjectId.isValid(doc.id)) doc._id = new ObjectId(doc.id);
          
          // Cast cross-collection relational strings to actual ObjectIds
          if (typeof doc.rocket === 'string' && ObjectId.isValid(doc.rocket)) doc.rocket = new ObjectId(doc.rocket);
          if (typeof doc.launchpad === 'string' && ObjectId.isValid(doc.launchpad)) doc.launchpad = new ObjectId(doc.launchpad);
          
          return doc;
        });

        const collection = db.collection(colName);
        console.log(`Clearing old layout and populating entire production archive for [${colName}]...`);
        await collection.deleteMany({});
        await collection.insertMany(processedRecords);
        console.log(`✅ [${colName}] completely restored with ${processedRecords.length} records.`);
      }
    }

    console.log('🚀 UNIFIED PRODUCTION ARCHIVE SYNCED SUCCESSFULLY!');
  } catch (error) {
    console.error('Production data engine synchronization aborted:', error.message);
  } finally {
    await client.close();
    console.log('Database sync link disconnected.');
  }
};

seedCompleteProductionDatabase();
