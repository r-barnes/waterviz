
// Construct map, center if no location provided
var map = L.map('map', { maxZoom: 13 } );
var hash = new L.Hash(map);
if (!window.location.hash) {
    map.setView([37.958, -120.976], 8);
}

// Make the base map; a raster tile relief map from ESRI
var esriRelief = 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}';

var basemap = L.tileLayer(esriRelief, {
        attribution: '<a href="http://www.arcgis.com/home/item.html?id=9c5370d0b54f4de1b48a3792d7377ff2">ESRI shaded relief</a>, <a href="http://www.horizon-systems.com/NHDPlus/NHDPlusV2_home.php">NHDPlus v2</a>',
        maxZoom: 13
});
basemap.addTo(map);

// Add a single GeoJSON vector file for state boundaries
// This was loaded statically as a script; could also be AJAX
var stateLayer = new L.geoJson(usStates);
stateLayer.setStyle({ "color": "#444",
                      "weight": 1,
                      "fill": false,
                      "opacity": 1.0 });
stateLayer.addTo(map);

L.tileLayer('/nlcd/{z}/{x}/{y}.png',{tms:true}).addTo(map);


var requestsPool = {
  requests: {}, //list of urls
  timeouts: {},
  timeout:  1000*60*10, //In milliseconds
  fetch: function(url) {
    if(requestsPool.exists(url))
      return requestsPool.requests[url];

    requestsPool.timeouts[url] = setTimeout(function(u) {
        requestsPool.remove(u);
    }.bind(this, url), requestsPool.timeout); //Defining the timeout

    requestsPool.requests[url] = $.getJSON(url);
    return requestsPool.requests[url];
  },
  exists: function(url) {
    return requestsPool.requests.hasOwnProperty(url); //Return the Timeout ID if present or undefined
  },
  remove: function(url) {
    requestsPool.cancel(url);
    delete requestsPool.requests[url];
  },
  cancel: function(url) {
    clearTimeout(requestsPool.timeouts[url]); //cancel the timeout
    delete requestsPool.timeouts[url];
  }
}







function StyleTheRivers(feature){
  requestsPool.fetch('/gauges/reachflow/'+feature.properties.huc8)
  .done(function(val){
    $('.h'+feature.properties.huc8).css('stroke', (val.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*val.drank)]:'gray' );
    $('.h'+feature.properties.huc8).css('stroke-width', ((val.drank!==null)?(6*val.drank).toString():'2')+'px' );
  });
}
//$.getJSON('/gauges/reachflow/'+feature.properties.huc8, function(data){

// Style the river lines; width depends on its Strahler number
function riverStyle(feature) {
  return "stroke-width: " + feature.properties.strahler * map.getZoom()/13 + "px;stroke:#29439c;";
}

function riverClass(feature){
  StyleTheRivers(feature);
  return "river h" + feature.properties.huc8;
}

// Make the river overlay layer, vector tiles from our TileStache/Gunicorn server
var geojsonURL = "/rivers/{z}/{x}/{y}.json";
var riverLayer = new L.TileLayer.d3_geoJSON(geojsonURL, {
  class: riverClass,
  style: riverStyle
});
map.addLayer(riverLayer);


map.on('dragend', function(e) {
  //$('#spinnerBox').fadeIn();
  getStations();
});

var markers = new L.FeatureGroup();

var grad_colours = ['#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac']

L.control.layers().addTo(map);

function getStations() {
  // Clear markers before getting new ones
  markers.clearLayers();

  // Get map bounds from Leaflet.  getBounds() returns an object
  var bbox = map.getBounds();

  var addy = "/gauges/list/xmin/ymin/xmax/ymax";
  addy     = addy.replace("xmin",bbox._southWest.lng);
  addy     = addy.replace("ymin",bbox._southWest.lat);
  addy     = addy.replace("xmax",bbox._northEast.lng);
  addy     = addy.replace("ymax",bbox._northEast.lat);

  //use jQuery's getJSON() to call the SODA API for NYC 311
  $.getJSON(addy, function(data) {
    //iterate over each 311 complaint, add a marker to the map
    _.each(data, function(marker){
      var markerItem = L.circleMarker(
        [marker.lat,marker.lng],
        {
          radius:      5,
          color:       'black',
          fillColor:   (marker.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*marker.drank)]:'gray',
          fillOpacity: 1
        }
      );
      markerItem.on('mouseover', function(){
        $('#headerbar').html(marker.name);
        $('#bottomright').html(
          'Stage: ' + marker.svalue + ' ft<br>' +
          '<span class="ddate">'+marker.sdt+'</span><br>' +
          'Discharge: ' + marker.dvalue + ' cfs<br>' +
          '<span class="ddate">'+marker.ddt+'</span><br>' +
          'Rank: ' + marker.drank.toFixed(2)
          );
        console.log(marker);
      });

      // markerItem.bindPopup(
      //   '<h4>' + marker.complaint_type + '</h4>'
      //   + (new Date(marker.created_date)).toDateString()
      //   + ((marker.incident_address != null) ? '<br/>' + marker.incident_address : '')
      // );

      markers.addLayer(markerItem);
    });
    map.addLayer(markers);
  });
}

/*var counties = new L.geoJson();
counties.addTo(map);
$.getJSON({
  dataType: "json",
  url:      "counties.json",
  success:  function(data) {
    $(data.features).each(function(key, data) {
        counties.addData(data);
    });
}
}).error(function() {});
*/
