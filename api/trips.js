import { sharedStore } from '../lib/shared-store.js';
import { createTripsHandler } from '../lib/trips-handler.js';

export default createTripsHandler(sharedStore);
