import dotenv from 'dotenv';
import got from 'got';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const clearAndSeedAllCollections = async () => {
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

    console.log('Downloading pristine SpaceX backup snapshot from IBM S3...');
    const launchesData = await got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json();
    
    if (!launchesData || !Array.isArray(launchesData)) {
      throw new Error('Invalid or empty backup data payload received.');
    }

    const rocketsMap = new Map();
    const launchpadsMap = new Map();
    const coresMap = new Map();
    const capsulesMap = new Map();

    launchesData.forEach(launch => {
      // Convert launch root _id to a proper ObjectId
      if (launch._id) launch._id = new ObjectId(launch._id);

      // Extract and convert Rocket
      if (launch.rocket) {
        const rId = typeof launch.rocket === 'string' ? launch.rocket : (launch.rocket.id || launch.rocket._id);
        if (rId && ObjectId.isValid(rId) && !rocketsMap.has(rId)) {
          const rocketObj = typeof launch.rocket === 'object' ? launch.rocket : { name: 'Falcon' };
          rocketObj._id = new ObjectId(rId);
          rocketObj.id = rId;
          rocketsMap.set(rId, rocketObj);
        }
        // Keep reference aligned for Mongoose relationship populating
        launch.rocket = new ObjectId(rId);
      }

      // Extract and convert Launchpad
      if (launch.launchpad) {
        const pId = typeof launch.launchpad === 'string' ? launch.launchpad : (launch.launchpad.id || launch.launchpad._id);
        if (pId && ObjectId.isValid(pId) && !launchpadsMap.has(pId)) {
          const padObj = typeof launch.launchpad === 'object' ? launch.launchpad : { name: 'SpaceX Pad' };
          padObj._id = new ObjectId(pId);
          padObj.id = pId;
          launchpadsMap.set(pId, padObj);
        }
        launch.launchpad = new ObjectId(pId);
      }

      // Extract and convert Cores
      if (Array.isArray(launch.cores)) {
        launch.cores.forEach(c => {
          if (c.core) {
            const cId = typeof c.core === 'string' ? c.core : (c.core.id || c.core._id);
            if (cId && ObjectId.isValid(cId) && !coresMap.has(cId)) {
              const coreObj = typeof c.core === 'object' ? c.core : {};
              coreObj._id = new ObjectId(cId);
              coreObj.id = cId;
              coresMap.set(cId, coreObj);
            }
            c.core = new ObjectId(cId);
          }
        });
      }

      // Extract and convert Capsules
      if (Array.isArray(launch.capsules)) {
        launch.capsules.map((cap, index) => {
          const capId = typeof cap === 'string' ? cap : (cap.id || cap._id);
          if (capId && ObjectId.isValid(capId)) {
            if (!capsulesMap.has(capId)) {
              const capObj = typeof cap === 'object' ? cap : {};
              capObj._id = new ObjectId(capId);
              capObj.id = capId;
              capsulesMap.set(capId, capObj);
            }
            launch.capsules[index] = new ObjectId(capId);
          }
        });
      }
    });

    const rocketsArray = Array.from(rocketsMap.values());
    const launchpadsArray = Array.from(launchpadsMap.values());
    const coresArray = Array.from(coresMap.values());
    const capsulesArray = Array.from(capsulesMap.values());

    const collectionsToSeed = [
      { name: 'launches', data: launchesData },
      { name: 'rockets', data: rocketsArray },
      { name: 'launchpads', data: launchpadsArray },
      { name: 'cores', data: coresArray },
      { name: 'capsules', data: capsulesArray }
    ];

    for (const item of collectionsToSeed) {
      const collection = db.collection(item.name);
      console.log(`Clearing old ${item.name} collection...`);
      await collection.deleteMany({});
      
      if (item.data.length > 0) {
        console.log(`Injecting ${item.data.length} strict typed documents into [${item.name}]...`);
        await collection.insertMany(item.data);
      }
    }

    console.log('🚀 SYSTEM SEEDED SUCCESSFULLY WITH VALID OBJECTIDS!');
  } catch (error) {
    console.error('Multi-collection seeding script failed:', error.message);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
};

clearAndSeedAllCollections();
