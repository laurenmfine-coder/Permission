// Audience routing for Flodesk.
//
// Every signup can carry an `audience` (or, from the older hub forms, a
// `situation`) naming the client type it came from. Each audience maps to an
// optional Vercel environment variable holding a Flodesk segment id. Set the
// variable and that audience's welcome sequence can fire; leave it unset and
// the signup still lands in FLODESK_SEGMENT_ID exactly as before.
//
// To turn an audience on:
//   1. Flodesk -> Audience -> Segments -> New segment (e.g. "Audience: Working moms").
//   2. Copy the segment id from the segment's URL.
//   3. Vercel -> Project -> Settings -> Environment Variables -> add the name
//      below with that id, then redeploy.
//   4. Flodesk -> Workflows -> trigger "Subscriber added to segment" -> that segment.

const AUDIENCE_SEGMENT_ENV = {
  'boundaries': 'FLODESK_SEGMENT_BOUNDARIES',
  'people-pleasing': 'FLODESK_SEGMENT_BOUNDARIES',
  'lawyers': 'FLODESK_SEGMENT_LAWYERS',
  'new-leaders': 'FLODESK_SEGMENT_NEW_LEADERS',
  'academics': 'FLODESK_SEGMENT_ACADEMICS',
  'working-moms': 'FLODESK_SEGMENT_DEFAULT_ONE',
  'caregivers': 'FLODESK_SEGMENT_DEFAULT_ONE',
  'physician-moms': 'FLODESK_SEGMENT_PHYSICIAN_MOMS',
  'habits': 'FLODESK_SEGMENT_HABITS',
  'side-build': 'FLODESK_SEGMENT_SIDE_BUILD',
  'reinvention': 'FLODESK_SEGMENT_REINVENTION',
  'decisions': 'FLODESK_SEGMENT_REINVENTION',
  'shopping': 'FLODESK_SEGMENT_DEALS'
};

function normalize(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

// Returns { audience, segmentId } for the request body, or nulls.
function audienceFor(data) {
  const candidates = [data.audience, data.situation];
  for (let i = 0; i < candidates.length; i++) {
    const key = normalize(candidates[i]);
    if (AUDIENCE_SEGMENT_ENV[key]) {
      return { audience: key, segmentId: process.env[AUDIENCE_SEGMENT_ENV[key]] || '' };
    }
  }
  return { audience: '', segmentId: '' };
}

module.exports = { audienceFor: audienceFor, AUDIENCE_SEGMENT_ENV: AUDIENCE_SEGMENT_ENV };
