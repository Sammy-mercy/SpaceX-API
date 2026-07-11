import dotenv from 'dotenv';
import { logger } from '../middleware/index.js';
import launches from './launches.js';
import payloads from './payloads.js';
import landpads from './landpads.js';
import launchpads from './launchpads.js';
import capsules from './capsules.js';
import cores from './cores.js';
import roadster from './roadster.js';
import upcoming from './upcoming.js';
import starlink from './starlink.js';
// import webcast from './webcast.js';             // Dropped broken script
// import launchLibrary from './launch-library.js'; // Dropped broken script

// Env init
dotenv.config();

const seedEverything = async () => {
  try {
    logger.info('Starting manual sequence database seeding...');
    
    // We run them sequentially so they don't fight for DB connections
    logger.info('Seeding launchpads...');
    await launchpads();
    
    logger.info('Seeding landpads...');
    await landpads();
    
    logger.info('Seeding capsules...');
    await capsules();
    
    logger.info('Seeding cores...');
    await cores();
    
    logger.info('Seeding roadster...');
    await roadster();
    
    logger.info('Seeding payloads...');
    await payloads();
    
    logger.info('Seeding starlink...');
    await starlink();
    
    logger.info('Seeding upcoming...');
    await upcoming();
    
    logger.info('Seeding launches...');
    await launches();

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    const formatted = {
      name: 'worker-manual-seed',
      error: error.message,
      stack: error.stack,
    };
    logger.error(formatted);
  }
};

// Execute immediately upon worker startup
seedEverything();
