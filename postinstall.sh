mkdir -p public/bootstrap
mkdir -p public/jquery
mkdir -p public/json-viewer

cp -r node_modules/bootstrap/dist/* public/bootstrap/.
cp -r node_modules/jquery/dist/* public/jquery/.
cp -r node_modules/jquery.json-viewer/json-viewer/* public/json-viewer
