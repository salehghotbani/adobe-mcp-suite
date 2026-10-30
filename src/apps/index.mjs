import { tools as premiere } from './premiere-pro.mjs';
import { tools as photoshop } from './photoshop.mjs';
import { tools as encoder } from './media-encoder.mjs';
import { tools as illustrator } from './illustrator.mjs';
import { tools as indesign } from './indesign.mjs';
import { tools as afterEffects } from './after-effects.mjs';
import { tools as audition } from './audition.mjs';
export const catalogs = {
  'premiere-pro': premiere,
  photoshop,
  'media-encoder': encoder,
  illustrator,
  indesign,
  'after-effects': afterEffects,
  audition
};
