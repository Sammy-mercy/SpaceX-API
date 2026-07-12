import dotenv from 'dotenv';
import got from 'got';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const clearAndSeedMasterStatic = async () => {
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

    // 1. Fetch pristine raw snapshots where IDs are already formatted perfectly
    console.log('Downloading pre-formatted datasets...');
    const [launches, rockets] = await Promise.all([
      got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json(),
      got.get('https://api.jsonbin.io/v3/b/661001e0e41b4d34e4dedb42?meta=false').json()
    ]);

    // 2. Map and apply standard BSON ObjectIds to the documents natively
    const formattedLaunches = launches.map(l => {
      if (l._id) l._id = new ObjectId(l._id);
      if (typeof l.rocket === 'string' && ObjectId.isValid(l.rocket)) l.rocket = new ObjectId(l.rocket);
      if (typeof l.launchpad === 'string' && ObjectId.isValid(l.launchpad)) l.launchpad = new ObjectId(l.launchpad);
      return l;
    });

    const formattedRockets = rockets.map(r => {
      const targetId = r._id || r.id;
      if (targetId && ObjectId.isValid(targetId)) {
        r._id = new ObjectId(targetId);
      }
      return r;
    });

    // 3. Clean and inject directly into your database collections
    const collections = [
      { name: 'launches', data: formattedLaunches },
      { name: 'rockets', data: formattedRockets }
    ];

    for (const col of collections) {
      const collection = db.collection(col.name);
      console.log(`Clearing collection: ${col.name}...`);
      await collection.deleteMany({});
      
      console.log(`Injecting ${col.data.length} clean records into [${col.name}]...`);
      await collection.insertMany(col.data);
    }

    console.log('🚀 CLEAN RE-SEED COMPLETE! DATABASES ARE COMPLETELY ALIGNED.');
  } catch (error) {
    console.error('Static seeding operation failed:', error.message);
  } finally {
    await client.close();
    console.log('Database synchronization connection dropped safely.');
  }
};

clearAndSeedMasterStatic();
