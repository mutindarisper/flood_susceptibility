var l8Tiwi = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA')
   .filterDate('2017-01-01', '2017-12-31')
 
  


var visParams = {bands: ['B4', 'B3', 'B2'],min:0.046982601284980774, max: 0.188396155834198};
Map.centerObject(kwale, 9)
// Map.addLayer(l8Tiwi.median().clip(table), visParams, 'l8Tiwi');

var getQABits = function(image, start, end, newName) {
    // Compute the bits we need to extract.
    var pattern = 0;
    for (var i = start; i <= end; i++) {
       pattern += Math.pow(2, i);
    }
    // Return a single band image of the extracted QA bits, giving the band
    // a new name.
    return image.select([0], [newName])
                  .bitwiseAnd(pattern)
                  .rightShift(start);
};

// A function to mask out cloudy pixels.
var cloud_shadows = function(image) {
  // Select the QA band.
  var QA = image.select(['BQA']);
  // Get the internal_cloud_algorithm_flag bit.
  return getQABits(QA, 7,8, 'Cloud_shadows').eq(1);
  // Return an image masking out cloudy areas.
};

// A function to mask out cloudy pixels.
var clouds = function(image) {
  // Select the QA band.
  var QA = image.select(['BQA']);
  // Get the internal_cloud_algorithm_flag bit.
  return getQABits(QA, 4,4, 'Cloud').eq(0);
  // Return an image masking out cloudy areas.
};

var maskClouds = function(image) {
  var cs = cloud_shadows(image);
  var c = clouds(image);
  image = image.updateMask(cs);
  return image.updateMask(c);
};

var l8TiwiMasked = l8Tiwi.map(maskClouds).median().clip(kwale);
print(l8TiwiMasked, 'l8TiwiMasked') 

Map.addLayer(kwale, {}, 'kwale county', false)
Map.addLayer(l8TiwiMasked, visParams, 'Kwale Masked'); 

/////////////////////       Calculate Frequency Ratios    //////////////////
//soilDrainage, surficial materials, landcover, slope, topographic wetness index, elevation, height above nearest drainage(HAND) ///////////////////////

//Soil Drainage
//use soil texture for now
var soil_drainage = soil_texture.clip(kwale)
var visualization = {
  bands: ['b0', 'b10', 'b30'],
  min: 1.0,
  max: 12.0,
  // palette: [
  //   "d5c36b","b96947","9d3706","ae868f","f86714","46d143",
  //   "368f20","3e5a14","ffd557","fff72e","ff5a9d","ff005b",
  // ]
};
Map.addLayer(soil_drainage, visualization, 'soil texture')


//land cover
var lc = ee.Image('ESA/WorldCover/v100/2020').select('Map').clip(kwale);
print(lc)
Map.addLayer(lc, {}, 'land cover')


//slope
var SRTM = ee.Image("USGS/SRTMGL1_003");

var Terrain = ee.call('Terrain',SRTM)
print(Terrain, 'terrain bands')

var slope = Terrain.select('slope').clip(kwale);
Map.addLayer(slope, {},'slope');

// var slope = ee.Terrain.slope(SRTM).clip(kwale);
// Map.addLayer(slope, {}, 'slope')

// print(SRTM)

//elevation
var elevation = Terrain.select('elevation').clip(kwale);
Map.addLayer(elevation, {}, 'Elevation');



// Export.image.toDrive({
//   image: elevation,
//   description :' Elevation',
//   region :kwale,
//   scale :30,
//   maxPixels :1e13
// });




//topographic wetness index 
//to be performed in arcgis
var fa = flow_acc.clip(kwale)
Map.addLayer(fa, {min:1, max:9537}, 'flow accumulation')

Export.image.toDrive({
  image: fa,
  description :' flow accumulation',
  region :kwale,
  scale :30,
  maxPixels :1e13
});



//HAND

// Load the global the MERIT Hydro (Global Hydrography Datasets)
var hand = ee.Image("MERIT/Hydro/v1_0_1");
print(hand, 'hand')

// Select Height Above Nearest Drainage (HAND)
var hand = hand.select('hnd');

// Reclassify Height Above Nearest Drainage (HAND) to the following classes
// 1 = 89 - 1800; 2 = 29 - 90; 3 = 9 - 30; 4 = 0 -8

var hand_reclass = ee.Image(1).rename('hnd')
          .where(hand.gt(89).and(hand.lte(1800)), 1)
          .where(hand.gt(29).and(hand.lte(90)), 2)
          .where(hand.gt(9).and(hand.lte(30)), 3)
          .where(hand.gt(0).and(hand.lte(8)), 4);

// Note class 1 represents low flooding susceptibility, while class 4 represents high flooding susceptibility.

// Load and define a continuous palette
var palettes = require('users/gena/packages:palettes');

// Choose and define a palette
var palette = palettes.cmocean.Solar[7];

Map.addLayer(hand.clip(kwale), {min: 1, max: 4, palette: palette}, 'HAND')

Export.image.toDrive({
  image: hand,
  description :'hand',
  region :kwale,
  scale :30,
  maxPixels :1e13
});
Map.addLayer(hand_reclass.clip(kwale), {min: 1, max: 4, palette: palette}, 'HAND Reclassified')


//flood event raster for kwale
var gfd = ee.ImageCollection('GLOBAL_FLOOD_DB/MODIS_EVENTS/V1');


var country = 'Kenya'

var hurricaneKenya = ee.Image(
    gfd.filterMetadata('dfo_country', 'equals', country).first());
    
    print('hurricaneKenya', hurricaneKenya)
    Map.addLayer(hurricaneKenya, {}, 'Kenya floodplain', false)
    
    var kwaleFloodPlain = ee.Image(
    gfd.filterMetadata('dfo_country', 'equals', country).mosaic().clip(kwale));
    
    
    print('flood kenya', kwaleFloodPlain)
    Map.addLayer(kwaleFloodPlain,  {},  'Kwale Flood Plain')
    
    // Map all floods to generate the satellite-observed historical flood plain.
var gfdFloodedSum = gfd.select('flooded').sum().clip(kwale).toDouble();
var durationPalette = ['C3EFFE', '1341E8', '051CB0', '001133'];
Map.addLayer(
  gfdFloodedSum.selfMask(),
  {min: 0, max: 10, palette: durationPalette},
  'GFD Satellite Observed Flood Plain');


//   var flooded = kwaleFloodPlain.select('flooded')
//   print('flooded',flooded)
//   var flooded_vis_params = {
//     min: 0,
//     max:1,
//     palette:['#2dbcff']
//   }
//   Map.addLayer(flooded, flooded_vis_params, 'flooded')

Export.image.toDrive({
  image: gfdFloodedSum,
  description :'gfdFloodedSum',
  region :kwale,
  scale :10,
  maxPixels :1e13
});