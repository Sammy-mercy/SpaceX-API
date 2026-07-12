import dotenv from 'dotenv';
import got from 'got';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const extractAndSeedMaster = async () => {
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

    console.log('Streaming multi-megabyte production master backup from IBM S3...');
    const masterLaunches = await got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json();
    
    if (!masterLaunches || !Array.isArray(masterLaunches)) {
      throw new Error('Could not parse valid raw backup stream array.');
    }

    // Storage maps to filter duplicates while preserving rich nested technical configurations
    const rocketsMap = new Map();
    const launchpadsMap = new Map();
    const landpadsMap = new Map();
    const capsulesMap = new Map();
    const coresMap = new Map();

    const cleanLaunches = masterLaunches.map(launch => {
      // 1. Process and extract deeply nested Full-Spec Rocket profiles
      if (launch.rocket) {
        const rId = typeof launch.rocket === 'string' ? launch.rocket : (launch.rocket.id || launch.rocket._id);
        if (rId) {
          if (typeof launch.rocket === 'object' && !rocketsMap.has(rId)) {
            rocketsMap.set(rId, { ...launch.rocket, _id: new ObjectId(rId), id: rId });
          }
          launch.rocket = new ObjectId(rId);
        }
      }

      // 2. Process and extract full Launchpad configurations
      if (launch.launchpad) {
        const pId = typeof launch.launchpad === 'string' ? launch.launchpad : (launch.launchpad.id || launch.launchpad._id);
        if (pId) {
          if (typeof launch.launchpad === 'object' && !launchpadsMap.has(pId)) {
            launchpadsMap.set(pId, { ...launch.launchpad, _id: new ObjectId(pId), id: pId });
          }
          launch.launchpad = new ObjectId(pId);
        }
      }

      // 3. Process and extract Cores and Landpads out of the historical components arrays
      if (Array.isArray(launch.cores)) {
        launch.cores = launch.cores.map(c => {
          if (c.core) {
            const cId = typeof c.core === 'string' ? c.core : (c.core.id || c.core._id);
            if (cId) {
              if (typeof c.core === 'object' && !coresMap.has(cId)) {
                coresMap.set(cId, { ...c.core, _id: new ObjectId(cId), id: cId });
              }
              c.core = new ObjectId(cId);
            }
          }
          if (c.landpad) {
            const lpId = typeof c.landpad === 'string' ? c.landpad : (c.landpad.id || c.landpad._id);
            if (lpId) {
              if (typeof c.landpad === 'object' && !landpadsMap.has(lpId)) {
                landpadsMap.set(lpId, { ...c.landpad, _id: new ObjectId(lpId), id: lpId });
              }
              c.landpad = new ObjectId(lpId);
            }
          }
          return c;
        });
      }

      // 4. Process and extract historical Capsule structures
      if (Array.isArray(launch.capsules)) {
        launch.capsules = launch.capsules.map(cap => {
          const capId = typeof cap === 'string' ? cap : (cap.id || cap._id);
          if (capId) {
            if (typeof cap === 'object' && !capsulesMap.has(capId)) {
              capsulesMap.set(capId, { ...cap, _id: new ObjectId(capId), id: capId });
            }
            return new ObjectId(capId);
          }
          return cap;
        });
      }

      // Cast the parent launch ID properly
      if (launch._id) launch._id = new ObjectId(launch._id);
      return launch;
    });

    // Build lists from our parsed maps
    const targets = [
      { name: 'launches', data: cleanLaunches },
      { name: 'rockets', data: Array.from(rocketsMap.values()) },
      { name: 'launchpads', data: Array.from(launchpadsMap.values()) },
      { name: 'landpads', data: Array.from(landpadsMap.values()) },
      { name: 'capsules', data: Array.from(capsulesMap.values()) },
      { name: 'cores', data: Array.from(coresMap.values()) }
    ];

    // Seed everything into their database folders
    for (const target of targets) {
      const collection = db.collection(target.name);
      await collection.deleteMany({});
      
      if (target.data.length > 0) {
        console.log(`Writing ${target.data.length} full-spec items into collection [${target.name}]...`);
        await collection.insertMany(target.data);
      }
    }

    console.log('🚀 SYSTEM RECOVERY COMPLETE. EVERY FOLDER LOADED WITH FULL SPECS!');
  } catch (error) {
    console.error('Extraction process runtime error:', error.message);
  } finally {
    await client.close();
    console.log('Database synchronization connection terminated safely.');
  }
};

extractAndSeedMaster();
