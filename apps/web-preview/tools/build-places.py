"""Build public locality references; no visitor data or job locations are inferred.

python3 apps/web-preview/tools/build-places.py ES.zip admin2Codes.txt postal-ES.zip
Inputs: download.geonames.org/export/dump/{ES.zip,admin2Codes.txt}, export/zip/ES.zip
"""
import collections
import datetime
import hashlib
import gzip
import json
import math
import pathlib
import sys
import unicodedata
import zipfile


def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.casefold())
                   if not unicodedata.combining(c)).strip()


def valid_point(latitude, longitude):
    return math.isfinite(latitude) and math.isfinite(longitude) and 27 <= latitude <= 44.5 and -18.5 <= longitude <= 4.6


def build(dump_path, admin_path, postal_path, output):
    with zipfile.ZipFile(dump_path) as archive:
        rows = [line.split('\t') for line in archive.read('ES.txt').decode('utf-8').splitlines()]
    with zipfile.ZipFile(postal_path) as archive:
        postal_rows = [line.split('\t') for line in archive.read('ES.txt').decode('utf-8').splitlines()]
    province_names = {row[6]: row[5] for row in postal_rows if len(row) >= 12 and row[0] == 'ES'}
    provinces = {}
    for line in pathlib.Path(admin_path).read_text().splitlines():
        fields = line.split('\t')
        if fields[0].startswith('ES.'):
            code = fields[0].split('.')[-1]
            provinces[code] = province_names.get(code, fields[1])
    municipalities = {r[12]: r[1] for r in rows if len(r) == 19 and r[6:9] == ['A', 'ADM3', 'ES']}
    postal = {}
    for row in postal_rows:
        if len(row) != 12 or row[0] != 'ES':
            continue
        latitude, longitude = float(row[9]), float(row[10])
        if not valid_point(latitude, longitude):
            continue
        key = (normalize(row[2]), row[6], row[8])
        item = postal.setdefault(key, {'name': row[2], 'province': row[5], 'municipality': row[7],
                                       'latitude': latitude, 'longitude': longitude, 'postalCodes': set()})
        item['postalCodes'].add(row[1])
    places, used_postal = [], set()
    for row in rows:
        if len(row) != 19 or row[8] != 'ES' or row[6] != 'P' or row[7] in ('PPLH', 'PPLQ', 'PPLW'):
            continue
        latitude, longitude = float(row[4]), float(row[5])
        if not valid_point(latitude, longitude):
            continue
        names = list(dict.fromkeys([row[1], row[2], *row[3].split(',')]))
        keys = {(normalize(name), row[11], row[12]) for name in names}
        matches = {key for key in keys if key in postal}
        codes = sorted({code for key in matches for code in postal[key]['postalCodes']})
        used_postal.update(matches)
        places.append({'id': 'geonames-' + row[0], 'name': row[1], 'aliases': [n for n in names[1:] if n],
                       'province': provinces.get(row[11], row[11]), 'municipality': municipalities.get(row[12], ''),
                       'postalCodes': codes, 'latitude': latitude, 'longitude': longitude,
                       'sourceUrl': 'https://www.geonames.org/' + row[0], 'precision': 'locality', 'updatedAt': row[18]})
    for index, (key, item) in enumerate(sorted(postal.items())):
        if key in used_postal:
            continue
        places.append({**item, 'id': 'postal-' + str(index), 'postalCodes': sorted(item['postalCodes']),
                       'sourceUrl': 'https://download.geonames.org/export/zip/ES.zip', 'precision': 'postal_locality'})
    supplemental = json.loads((output.parent.parent / 'public/data/places.json').read_text())
    places.extend(p for p in supplemental['places'] if p['id'].startswith('osm-'))
    labels = collections.Counter((p['name'], p['municipality'], p['province']) for p in places)
    for place in places:
        context = ', '.join(dict.fromkeys(c for c in (place.get('municipality'), place.get('province')) if c and c != place['name']))
        label = place['name'] + (' · ' + context if context else '')
        if place['postalCodes']:
            label += ' (' + ', '.join(place['postalCodes'][:3]) + ('…' if len(place['postalCodes']) > 3 else '') + ')'
        if labels[(place['name'], place.get('municipality', ''), place.get('province', ''))] > 1:
            label += ' [' + place['id'] + ']'
        place['label'] = label
    sources = [{'url': url, 'sha256': hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()}
               for path, url in [(dump_path, 'https://download.geonames.org/export/dump/ES.zip'),
                                 (admin_path, 'https://download.geonames.org/export/dump/admin2Codes.txt'),
                                 (postal_path, 'https://download.geonames.org/export/zip/ES.zip')]]
    result = {'retrievedAt': datetime.date.today().isoformat(), 'license': 'https://creativecommons.org/licenses/by/4.0/',
              'sources': sources, 'note': 'OpenStreetMap supplements declare their own source and ODbL license.', 'places': places}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    temporary.replace(output)
    print(json.dumps({'places': len(places), 'postal_references': sum(p['precision'] == 'postal_locality' for p in places),
                      'bytes': output.stat().st_size}))


if __name__ == '__main__':
    build(*sys.argv[1:4], pathlib.Path(__file__).resolve().parent.parent / 'data/spain-places.json.gz')
