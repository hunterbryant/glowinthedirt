import { initInteractions } from './interactions';
import { initBackgroundVideos, initDelayLinks, initLightbox, initSliders } from './components';
import interactions from '../data/interactions.json';

initInteractions(interactions);
initDelayLinks();
initSliders();
initLightbox();
initBackgroundVideos();
