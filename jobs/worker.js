import dotenv from 'dotenv';
import got from 'got';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const cleanAndSeedFinal = async () => {
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

    // 1. Download the working launches dataset
    console.log('Downloading pristine launches dataset...');
    const launches = await got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json();
    
    if (!launches || !Array.isArray(launches)) {
      throw new Error('Invalid or empty launch backup payload.');
    }

    // 2. Hardcoded flawless historical Rockets data with strict ObjectIds
    const rockets = [
      {
        _id: new ObjectId("5e9d0d95eda69955f709d1eb"),
        id: "5e9d0d95eda69955f709d1eb",
        name: "Falcon 1",
        type: "rocket",
        active: false,
        stages: 2,
        boosters: 0,
        cost_per_launch: 6700000,
        success_rate_pct: 40,
        first_flight: "2006-03-24"
      },
      {
        _id: new ObjectId("5e9d0d95eda69973a809d1ec"),
        id: "5e9d0d95eda69973a809d1ec",
        name: "Falcon 9",
        type: "rocket",
        active: true,
        stages: 2,
        boosters: 0,
        cost_per_launch: 50000000,
        success_rate_pct: 98,
        first_flight: "2010-06-04"
      },
      {
        _id: new ObjectId("5e9d0d95eda69974db09d1ed"),
        id: "5e9d0d95eda69974db09d1ed",
        name: "Falcon Heavy",
        type: "rocket",
        active: true,
        stages: 2,
        boosters: 2,
        cost_per_launch: 90000000,
        success_rate_pct: 100,
        first_flight: "2018-02-06"
      },
      {
        _id: new ObjectId("5e9d0d96eda699382d09d1ee"),
        id: "5e9d0d96eda699382d09d1ee",
        name: "Starship",
        type: "rocket",
        active: true,
        stages: 2,
        boosters: 0,
        cost_per_launch: 7000000,
        success_rate_pct: 100,
        first_flight: "2023-04-20"
      }
    ];

    // 3. Format the launch documents so they link up correctly with Mongoose types
    const formattedLaunches = launches.map(l => {
      if (l._id) l._id = new ObjectId(l._id);
      if (typeof l.rocket === 'string' && ObjectId.isValid(l.rocket)) l.rocket = new ObjectId(l.rocket);
      if (typeof l.launchpad === 'string' && ObjectId.isValid(l.launchpad)) l.launchpad = new ObjectId(l.launchpad);
      return l;
    });

    // 4. Wipe and seed collections cleanly
    console.log('Wiping out old collections...');
    await db.collection('launches').deleteMany({});
    await db.collection('rockets').deleteMany({});

    console.log('Injecting fresh records...');
    await db.collection('launches').insertMany(formattedLaunches);
    await db.collection('rockets').insertMany(rockets);

    console.log('🚀 CLEAN RE-SEED COMPLETE! ALL SYSTEMS OPERATIONAL.');
  } catch (error) {
    console.error('Seeding process failed:', error.message);
  } finally {
    await client.close();
    console.log('Database connection dropped safely.');
  }
};

cleanAndSeedFinal();
