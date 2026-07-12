import dotenv from 'dotenv';
import got from 'got';
import { MongoClient } from 'mongodb';

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

    // --- EXTRACTING DATA FOR OTHER FOLDERS ---
    const rocketsMap = new Map();
    const launchpadsMap = new Map();
    const coresMap = new Map();
    const capsulesMap = new Map();

    launchesData.forEach(launch => {
      // Extract Rocket info if present
      if (launch.rocket) {
        const rId = typeof launch.rocket === 'string' ? launch.rocket : (launch.rocket.id || launch.rocket._id);
        if (rId && !rocketsMap.has(rId)) {
          rocketsMap.set(rId, typeof launch.rocket === 'object' ? launch.rocket : { _id: rId, id: rId, name: 'Falcon' });
        }
      }

      // Extract Launchpad info if present
      if (launch.launchpad) {
        const pId = typeof launch.launchpad === 'string' ? launch.launchpad : (launch.launchpad.id || launch.launchpad._id);
        if (pId && !launchpadsMap.has(pId)) {
          launchpadsMap.set(pId, typeof launch.launchpad === 'object' ? launch.launchpad : { _id: pId, id: pId, name: 'SpaceX Pad' });
        }
      }

      // Extract Cores if present
      if (Array.isArray(launch.cores)) {
        launch.cores.forEach(c => {
          if (c.core) {
            const cId = typeof c.core === 'string' ? c.core : (c.core.id || c.core._id);
            if (cId && !coresMap.has(cId)) {
              coresMap.set(cId, typeof c.core === 'object' ? c.core : { _id: cId, id: cId });
            }
          }
        });
      }

      // Extract Capsules if present
      if (Array.isArray(launch.capsules)) {
        launch.capsules.forEach(cap => {
          const capId = typeof cap === 'string' ? cap : (cap.id || cap._id);
          if (capId && !capsulesMap.has(capId)) {
            capsulesMap.set(capId, typeof cap === 'object' ? cap : { _id: capId, id: capId });
          }
        });
      }
    });

    const rocketsArray = Array.from(rocketsMap.values());
    const launchpadsArray = Array.from(launchpadsMap.values());
    const coresArray = Array.from(coresMap.values());
    const capsulesArray = Array.from(capsulesMap.values());

    // --- WIPING AND INJECTING INTO COLLECTIONS ---
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
        console.log(`Injecting ${item.data.length} documents into [${item.name}]...`);
        await collection.insertMany(item.data);
      }
    }

    console.log('🚀 MASTER DATABASE POPULATED SUCCESSFULLY ACROSS ALL FOLDERS!');
  } catch (error) {
    console.error('Multi-collection seeding script failed:', error.message);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
};

clearAndSeedAllCollections();
