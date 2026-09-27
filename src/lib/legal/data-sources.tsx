import type { ReactNode } from "react";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function DataSourcesEn() {
  return (
    <>
      <Block title="OpenStreetMap (ODbL 1.0)">
        <p>
          Piste geometries and many resort statistics. Attribution: © OpenStreetMap contributors. Derivative GeoJSON under{" "}
          <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>. See DATA_LICENSE.md in the repository.
        </p>
      </Block>
      <Block title="OpenSkiMap">
        <p>Resort locations and ski-area metadata derived from OpenStreetMap (ODbL).</p>
      </Block>
      <Block title="OpenFreeMap / OpenMapTiles">
        <p>Default vector basemap. © OpenFreeMap © OpenMapTiles Data from OpenStreetMap.</p>
      </Block>
      <Block title="Mapbox">
        <p>Optional basemap for the first 3 visits and for supporters, after consent and within the monthly load budget. © Mapbox © OpenStreetMap.</p>
      </Block>
      <Block title="OpenSnowMap">
        <p>Optional piste overlay tiles © www.opensnowmap.org (CC BY-SA), data © OpenStreetMap.</p>
      </Block>
      <Block title="Terrain Tiles (elevation)">
        <p>
          Relief shading and 3D terrain use the Terrain Tiles on AWS Open Data (Mapzen / Tilezen). Austria: © offene Daten Österreichs – Digitales
          Geländemodell (DGM) Österreich (CC BY 4.0). Europe: produced using Copernicus data and information funded by the European Union – EU-DEM layers.
          Elsewhere: SRTM and GMTED2010, courtesy of the U.S. Geological Survey.{" "}
          <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Full attribution</a>.
        </p>
      </Block>
      <Block title="Pass and resort facts">
        <p>Compiled from official operator websites with per-field source URLs and check dates shown in the app.</p>
      </Block>
    </>
  );
}

export function DataSourcesHu() {
  return (
    <>
      <Block title="OpenStreetMap (ODbL 1.0)">
        <p>© OpenStreetMap közreműködők. Lásd DATA_LICENSE.md.</p>
      </Block>
      <Block title="OpenSkiMap, OpenFreeMap, Mapbox, OpenSnowMap">
        <p>Ugyanazok a licencek, mint az angol szövegben; részletek az angol változatban.</p>
      </Block>
      <Block title="Domborzat (Terrain Tiles)">
        <p>
          A domborzatárnyékolás és a 3D terep az AWS Open Data Terrain Tiles adatait használja. Ausztria: © offene Daten Österreichs – Digitales
          Geländemodell (DGM) Österreich (CC BY 4.0); Európa: Copernicus EU-DEM; máshol: USGS SRTM.{" "}
          <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Teljes forrásmegjelölés</a>.
        </p>
      </Block>
      <Block title="Bérlet- és síterep-adatok">
        <p>Hivatalos weboldalak, forrásmegjelöléssel.</p>
      </Block>
    </>
  );
}
