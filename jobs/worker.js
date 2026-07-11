import dotenv from 'dotenv';
import got from 'got';
import { logger } from '../middleware/index.js';

// Import the internal database models directly from your project
import { Launch } from '../models/launch.js';
import { Rocket } from '../models/rocket.js';
import { Payload } from '../models/payload.js';
import { Launchpad } from '../models/launchpad.js';
import { Landpad } from '../models/landpad.js';
import { Capsule } from '../models/capsule.js';
import { Core } from '../models/core.js';
import { Roadster } from '../models/roadster.js';

dotenv.config();

const backupSeed = async () => {
  try {
    logger.info('Starting external static backup seed process...');

    // 1. Fetch historical launches backup snapshot 
    logger.info('Downloading pristine SpaceX backup snapshot...');
    const response = await got.get('https://cf-courses-data.s3.us.cloud-object-storage.appdomain.cloud/IBM-DS0321EN-SkillsNetwork/datasets/API_call_spacex_api.json').json();
    
    if (!response || !Array.isArray(response)) {
      throw new Error('Invalid or empty backup data payload received.');
    }

    // 2. Clear out any existing empty state schemas
    logger.info('Clearing old collections...');
    await Promise.all([
      Launch.deleteMany({}),
      Rocket.deleteMany({}),
      Payload.deleteMany({}),
      Launchpad.deleteMany({}),
      Landpad.deleteMany({}),
      Capsule.deleteMany({}),
      Core.deleteMany({}),
      Roadster.deleteMany({})
    ]);

    // 3. Inject the clean historical array straight into the launches collection
    logger.info(`Injecting ${response.length} records into your MongoDB...`);
    await Launch.insertMany(response);

    logger.info('🚀 DATABASE POPULATED SUCCESSFULLY WITH ALL HISTORICAL DATA!');
  } catch (error) {
    logger.error('Backup seeding sequence failed:', error.message);
  }
};

backupSeed();
