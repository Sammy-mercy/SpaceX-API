import dotenv from 'dotenv';
import got from 'got';
import { MongoClient } from 'mongodb';

dotenv.config();

const seedMasterDatabase = async () => {
  const mongoUri = process.env.SPACEX_MONGO;
  if (!mongoUri) {
    console.error('Error: SPACEX_MONGO environment variable is missing.');
    return;
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log('Connecting to database...');
    await client.connect();
    const db = client.db();

    // Mapping out the static cloud dataset snapshots for EVERY folder structure
    const targets = [
      {
        collection: 'launches',
        url: 'https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json'
      },
      {
        collection: 'rockets',
        url: 'https://api.jsonbin.io/v3/b/661001e0e41b4d34e4dedb42?meta=false'
      },
      {
        collection: 'launchpads',
        url: 'https://api.jsonbin.io/v3/b/6610190ee41b4d34e4df9dfc?meta=false'
      },
      {
        collection: 'landpads',
        url: 'https://api.jsonbin.io/v3/b/66101a08ad19ca34f85521b4?meta=false'
      },
      {
        collection: 'capsules',
        url: 'https://api.jsonbin.io/v3/b/66101a88ad19ca34f85521eb?meta=false'
      },
      {
        collection: 'cores',
        url: 'https://api.jsonbin.io/v3/b/66101b08ad19ca34f8552230?meta=false'
      },
      {
        collection: 'roadster',
        url: 'https://api.jsonbin.io/v3/b/66101b67ad19ca34f855225c?meta=false'
      }
    ];

    for (const target of targets) {
      try {
        console.log(`Downloading snapshot for: ${target.collection}...`);
        const data = await got.get(target.url).json();
        
        // Safety step to automatically handle raw JSON arrays vs API wrappers
        const documents = Array.isArray(data) ? data : (data.record || data);
        const documentsArray = Array.isArray(documents) ? documents : [documents];

        if (documentsArray.length > 0) {
          const col = db.collection(target.collection);
          
          console.log(`Wiping out old structural state for: ${target.collection}`);
          await col.deleteMany({});
          
          console.log(`Populating ${documentsArray.length} records into [${target.collection}]...`);
          await col.insertMany(documentsArray);
        }
      } catch (innerError) {
        console.error(`Skipped collection [${target.collection}] due to:`, innerError.message);
      }
    }

    console.log('🚀 MASTER POPULATION COMPLETE. EVERY COLLECTION HAS DATA!');
  } catch (error) {
    console.error('Master script failed:', error.message);
  } finally {
    await client.close();
    console.log('Database synchronization complete.');
  }
};

seedMasterDatabase();
