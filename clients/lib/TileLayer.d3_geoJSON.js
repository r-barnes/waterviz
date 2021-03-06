/* Experimental vector tile layer for Leaflet
 * Uses D3 to render GeoJSON; faster than Leaflet's native.
 * Originally by Ziggy Jonsson: http://bl.ocks.org/ZJONSSON/5602552
 * Reworked by Nelson Minar: http://bl.ocks.org/NelsonMinar/5624141
 *
 * While working (and fast!) this plugin requires work to work like
 * a typical Leaflet layer. Todo:
 *   Make this work even if <svg> isn't in the DOM yet;
 *     For now, add a fake GeoJSON layer to your map before one of these
 *     new L.geoJson({"type":"LineString","coordinates":[[0,0],[0,0]]}).addTo(map);
 *   Make this work for tile types that aren't FeatureCollection
 *   Match D3 idioms for .classed(), .style(), etc? Or match the Leaflet API?
 *   Work on allowing feature popups, etc.
 */
L.TileLayer.d3_geoJSON =  L.TileLayer.extend({
    onAdd : function(map) {
        L.TileLayer.prototype.onAdd.call(this,map);
        this._path = d3.geo.path().projection(function(d) {
            var point = map.latLngToLayerPoint(new L.LatLng(d[1],d[0]));
            return [point.x,point.y];
        });
        this.on("tileunload",function(d) {
            if (d.tile.xhr) d.tile.xhr.abort();
            if (d.tile.nodes) d.tile.nodes.remove();
            d.tile.nodes = null;
            d.tile.xhr = null;
        });
    },
    _loadTile : function(tile,tilePoint) {
        var self = this;
        this._adjustTilePoint(tilePoint);

        if (!tile.nodes && !tile.xhr) {
            tile.xhr = d3.json(this.getTileUrl(tilePoint),function(geoJson) {
                tile.xhr = null;
                tile.nodes = d3.select(map._container).select("svg").append("g");
                tile.nodes.selectAll("path")
                    .data(geoJson.features).enter()
                  .append("path")
                    .attr("d", self._path)
                    .attr("class", self.options.class)
                    .attr("style", self.options.style)
                    .attr("data-huc8", function(x){return x.properties.huc8;})
                    .attr("data-name", function(x){return x.properties.name;})
                    .on("mouseover", function(x) {
                        $('#headerbar').html(x.properties.name);
                        d3.select(d3.event.target).classed("highlightriver", true);
                        if(!x.properties.svalue)
                            x.properties.svalue = "??";
                        else
                            x.properties.svalue = x.properties.svalue.toFixed(1);

                        if(!x.properties.dvalue)
                            x.properties.dvalue = "??";
                        else
                            x.properties.dvalue = x.properties.dvalue.toFixed(1);

                        if(!x.properties.drank)
                            x.properties.drank = "??";
                        else
                            x.properties.drank = x.properties.drank.toFixed(1);
                        $('#bottomright').html(
                          'Avg Stage: '     + x.properties.svalue + ' ft<br>' +
                          'Avg Discharge: ' + x.properties.dvalue + ' cfs<br>' +
                          'Avg Rank: '      + x.properties.drank + '%'
                        );
                    })
                    .on("mouseout",  function(x) { d3.select(d3.event.target).classed("highlightriver", false); });
            });
        }
    }
});
