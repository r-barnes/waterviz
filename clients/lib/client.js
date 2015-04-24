
// Construct map, center if no location provided
var map = L.map('map', {
  maxZoom:   13
  //minZoom:   1,
  /*maxBounds: [
    [20, -125], //Southwest
    [50,  -66]  //Northeast
  ]*/
});
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
//basemap.addTo(map);

// Add a single GeoJSON vector file for state boundaries
// This was loaded statically as a script; could also be AJAX
var stateLayer = new L.geoJson(usStates);
stateLayer.setStyle({ "color": "#444",
                      "weight": 1,
                      "fill": false,
                      "opacity": 1.0 });
stateLayer.addTo(map);

var nlcdlayer = L.tileLayer('/nlcd/{z}/{x}/{y}.png',{tms:true}).addTo(map);


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





var riverinfo = {};

// function StyleTheRivers(feature){
//   requestsPool.fetch('/gauges/reachflow/'+feature.properties.huc8)
//   .done(function(val){
//     riverinfo[feature.properties.huc8]=val;
//     $('.h'+feature.properties.huc8).css('stroke', (val.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*val.drank)]:'#FF00DE' );
//     $('.h'+feature.properties.huc8).css('stroke-width', ((val.drank!==null)?(6*val.drank+2).toString():'2')+'px' );
//   });
// }
//$.getJSON('/gauges/reachflow/'+feature.properties.huc8, function(data){

// Style the river lines; width depends on its Strahler number
function riverStyle(feature) {
  var fp   = feature.properties;
  var temp = "stroke:" + ((fp.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*fp.drank/100.0)]:'#FF00DE') + ';' + "stroke-width:" + ((fp.drank!==null)?(6*fp.drank/100.0+2).toString():fp.strahler * map.getZoom()/13)+'px' + ';';
  return temp;
}

function riverClass(feature){
//  StyleTheRivers(feature);
  return "river h" + feature.properties.huc8;
}

// Make the river overlay layer, vector tiles from our TileStache/Gunicorn server
var geojsonURL = "/rivers/{z}/{x}/{y}.json";
var riverLayer = new L.TileLayer.d3_geoJSON(geojsonURL, {
  class:         riverClass,
  style:         riverStyle,
});
map.addLayer(riverLayer);

var countystyle = {
  "color":       "black",
  "stroke":      "black",
  "weight":      3,
};

function highlightCounty(e) {
  var layer = e.target;

  layer.setStyle({
    weight:      5,
    color:       '#666',
  });

  if (!L.Browser.ie && !L.Browser.opera) {
      layer.bringToFront();
  }
}

function resetCounty(e) {
  var layer = e.target;

  layer.setStyle({
    weight: 3,
    color:  "black"
  });
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

function onEachCounty(feature, layer) {
  layer.on({
      mouseover: highlightCounty,
      mouseout:  resetCounty,
      click:     zoomToFeature
  });
}

var counties = new L.geoJson(null,{style:countystyle,onEachFeature:onEachCounty});
$.getJSON("/counties.json",
  function(data) {
    $(data.features).each(function(key, data) {
      counties.addData(data);
    });
  }
);

map.on('dragend', function(e) {
  //$('#spinnerBox').fadeIn();
  getStations();
});

map.on('zoomend', function() {
  getStations();
});

var markers = new L.FeatureGroup();
map.addLayer(markers);

var grad_colours = ['#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac']

var baseLayers = {
  "Terrain": basemap,
  "NLCD":    nlcdlayer,
};

var overlays = {
  "Rivers":         riverLayer,
  "Gauge Stations": markers,
  "Counties":       counties
};

L.control.layers(baseLayers, overlays).addTo(map);


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
          fillColor:   (marker.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*marker.drank)]:'#FF00DE',
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
          'Rank: ' + marker.drank.toFixed(2) + '<br>' +
          'More info <a href="'+marker.featuredet+'">here</a>'
          );
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

function colourCounties(style,percentile_max){
  $.getJSON('/county/style/'+style+'?percentile_max='+percentile_max,function(data){
    counties.setStyle(function(feature){
      var myid = feature.properties.STATE+feature.properties.COUNTY;
      return data[myid];
    });
  });
}
colourCounties('allwater',95);


$('.nlcdgrad').hover(function(e){
  var classname = $(e.target).data('classname');
  $('#nlcdexplanation').html(classname);
}, function(){
  $('#nlcdexplanation').html('NLCD Legend (hover over colours for details)');
});

var hurricanes = {};
//TODO: Prevent multiple calls to hurricanes for the same date
function timeChanged(newtime){
  //Load hurricanes into a dictionary of type: dict[DATE][STORMID]
  $.getJSON('/hurricanes/'+newtime, function(data){
    _.each(data['hurricanes'],function(o){
      if(!_.has(hurricanes,o.stormid))
        hurricanes[o.stormid] = {
          mintime: moment('2100-01-01','YYYY-MM-DD').unix(),
          maxtime: moment('1800-01-01','YYYY-MM-DD').unix(),
          points:  []
        };
      o.marker = L.circle([o.lat, o.lon], 500, {color: 'red',fillColor: '#f03',fillOpacity: 0.5}).addTo(map);
      hurricanes[o.stormid].points.push(o);
      hurricanes[o.stormid].mintime = Math.min(hurricanes[o.stormid].mintime, moment(o.dt,'YYYY-MM-DD').unix());
      hurricanes[o.stormid].maxtime = Math.max(hurricanes[o.stormid].maxtime, moment(o.dt,'YYYY-MM-DD').unix());
    });
  });
  _.each(hurricanes,function(o){
    if(_.has(o,'line'))
      return;
    o.line = turf.bezier(L.polyline(_.map(o.points,function(x){return [x.lat,x.lon];})).toGeoJSON());
  });
}

$(document).ready(function(){
  $('#datepicker').datepick({
    minDate:    '1950-01-01',
    maxDate:    'now',
    dateFormat: 'yyyy-mm-dd',
    onSelect:   function(date) { timeChanged(moment(date[0]).format('YYYY-MM-DD')); }
  });

  $('#datepicker').val(moment().format('YYYY-MM-DD'));

  $('#dateminus').click(function(){
    var dedate = moment($('#datepicker').val(), "YYYY-MM-DD");
    dedate.add(-1, 'days');
    if(dedate.unix()>=moment('1950-01-01').unix())
      $('#datepicker').val( dedate.format('YYYY-MM-DD') );
    timeChanged(dedate.format('YYYY-MM-DD'));
  });

  $('#dateplus').click(function(){
    var dedate = moment($('#datepicker').val(), "YYYY-MM-DD");
    dedate.add(1, 'days');
    if(dedate.unix()<moment().unix())
      $('#datepicker').val( dedate.format('YYYY-MM-DD') );
    timeChanged(dedate.format('YYYY-MM-DD'));
  });

  getStations();

});