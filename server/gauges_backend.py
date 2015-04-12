#!/usr/bin/env python
import requests
import redis
import psycopg2

conn = psycopg2.connect("dbname='rivers' user='nelson' host='localhost' password='NONE'")

states = [
  {"abbrev":"AK", "fips":"02","name":"ALASKA"},
  {"abbrev":"AL", "fips":"01","name":"ALABAMA"},
  {"abbrev":"AR", "fips":"05","name":"ARKANSAS"},
  {"abbrev":"AS", "fips":"60","name":"AMERICAN SAMOA"},
  {"abbrev":"AZ", "fips":"04","name":"ARIZONA"},
  {"abbrev":"CA", "fips":"06","name":"CALIFORNIA"},
  {"abbrev":"CO", "fips":"08","name":"COLORADO"},
  {"abbrev":"CT", "fips":"09","name":"CONNECTICUT"},
  {"abbrev":"DC", "fips":"11","name":"DISTRICT OF COLUMBIA"},
  {"abbrev":"DE", "fips":"10","name":"DELAWARE"},
  {"abbrev":"FL", "fips":"12","name":"FLORIDA"},
  {"abbrev":"GA", "fips":"13","name":"GEORGIA"},
  {"abbrev":"GU", "fips":"66","name":"GUAM"},
  {"abbrev":"HI", "fips":"15","name":"HAWAII"},
  {"abbrev":"IA", "fips":"19","name":"IOWA"},
  {"abbrev":"ID", "fips":"16","name":"IDAHO"},
  {"abbrev":"IL", "fips":"17","name":"ILLINOIS"},
  {"abbrev":"IN", "fips":"18","name":"INDIANA"},
  {"abbrev":"KS", "fips":"20","name":"KANSAS"},
  {"abbrev":"KY", "fips":"21","name":"KENTUCKY"},
  {"abbrev":"LA", "fips":"22","name":"LOUISIANA"},
  {"abbrev":"MA", "fips":"25","name":"MASSACHUSETTS"},
  {"abbrev":"MD", "fips":"24","name":"MARYLAND"},
  {"abbrev":"ME", "fips":"23","name":"MAINE"},
  {"abbrev":"MI", "fips":"26","name":"MICHIGAN"},
  {"abbrev":"MN", "fips":"27","name":"MINNESOTA"},
  {"abbrev":"MO", "fips":"29","name":"MISSOURI"},
  {"abbrev":"MS", "fips":"28","name":"MISSISSIPPI"},
  {"abbrev":"MT", "fips":"30","name":"MONTANA"},
  {"abbrev":"NC", "fips":"37","name":"NORTH CAROLINA"},
  {"abbrev":"ND", "fips":"38","name":"NORTH DAKOTA"},
  {"abbrev":"NE", "fips":"31","name":"NEBRASKA"},
  {"abbrev":"NH", "fips":"33","name":"NEW HAMPSHIRE"},
  {"abbrev":"NJ", "fips":"34","name":"NEW JERSEY"},
  {"abbrev":"NM", "fips":"35","name":"NEW MEXICO"},
  {"abbrev":"NV", "fips":"32","name":"NEVADA"},
  {"abbrev":"NY", "fips":"36","name":"NEW YORK"},
  {"abbrev":"OH", "fips":"39","name":"OHIO"},
  {"abbrev":"OK", "fips":"40","name":"OKLAHOMA"},
  {"abbrev":"OR", "fips":"41","name":"OREGON"},
  {"abbrev":"PA", "fips":"42","name":"PENNSYLVANIA"},
  {"abbrev":"PR", "fips":"72","name":"PUERTO RICO"},
  {"abbrev":"RI", "fips":"44","name":"RHODE ISLAND"},
  {"abbrev":"SC", "fips":"45","name":"SOUTH CAROLINA"},
  {"abbrev":"SD", "fips":"46","name":"SOUTH DAKOTA"},
  {"abbrev":"TN", "fips":"47","name":"TENNESSEE"},
  {"abbrev":"TX", "fips":"48","name":"TEXAS"},
  {"abbrev":"UT", "fips":"49","name":"UTAH"},
  {"abbrev":"VA", "fips":"51","name":"VIRGINIA"},
  {"abbrev":"VI", "fips":"78","name":"VIRGIN ISLANDS"},
  {"abbrev":"VT", "fips":"50","name":"VERMONT"},
  {"abbrev":"WA", "fips":"53","name":"WASHINGTON"},
  {"abbrev":"WI", "fips":"55","name":"WISCONSIN"},
  {"abbrev":"WV", "fips":"54","name":"WEST VIRGINIA"},
  {"abbrev":"WY", "fips":"56","name":"WYOMING"}
]

do_these_states = ["AL","AZ","AR","CA","CO","CT","DE","FL","GA","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
states          = filter(lambda x: x['abbrev'] in do_these_states,states)

def getData(state):
  ret = []
  translate_variable_code = {'00065':'S', '00060':'D'} #Stage and discharge\
  print("Gathering data for %s" % (state))
  url     = "http://waterservices.usgs.gov/nwis/iv/"
  options = {"format":"json","stateCd":state,"parameterCd":"00060,00065","siteStatus":"active"}
  resp    = requests.get(url,params=options)
  if resp.status_code!=200:
    pass
  resp = resp.json()
  for s in resp['value']['timeSeries']:
    if len(s['variable']['variableCode'])>1:
      print "More variables!"
    if len(s['values'][0]['value'])>1:
      print "More values!"
    if len(s['sourceInfo']['siteCode'])>1:
      print "More sites!"
    try:
      site_code     = s['sourceInfo']['siteCode'][0]['value']
      variable_code = s['variable']['variableCode'][0]['value']
      variable_code = translate_variable_code[variable_code]
      timestamp     = s['values'][0]['value'][0]['dateTime']
      value         = float(s['values'][0]['value'][0]['value'])
      ret.append( (site_code,variable_code,timestamp,value) )
    except:
      pass

  return ret

cur = conn.cursor() #cursor_factory = psycopg2.extras.RealDictCursor)
for state in states[0:2]:
  data = getAllData(state['abbrev'])
  print("Found %d records for %s." % (len(data),state['abbrev']))
  print data[0:10]

  cur.execute("CREATE TEMP TABLE tmp ON COMMIT DROP AS SELECT * FROM gauge_data with no data")
  #cur.execute("CREATE TABLE tmp AS SELECT * FROM gauge_data with no data")
  cur.executemany("""INSERT INTO tmp(site_code,variable,dt,value) VALUES (%s, %s, %s, %s)""", data)

  cur.execute("""
  INSERT INTO gauge_data
  SELECT * FROM tmp
  WHERE (site_code,variable,dt) NOT IN (
      SELECT site_code,variable,dt
      FROM gauge_data
  );
  """)

  conn.commit()

  for notice in conn.notices:
    print notice

