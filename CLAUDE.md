# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

This repository is for a **Naver Maps** integration project. Naver Maps (`@naver/maps` or the Naver Maps JavaScript API) is the primary mapping platform used in South Korea.

## Status

This project is currently empty. No source files, dependencies, or build tooling have been added yet.

## Setup (once initialized)

Update this section once the project stack is chosen. Common patterns for Naver Maps projects:

- **Web (Vanilla/TS)**: Load the Naver Maps JS API via `<script>` tag with a client ID from [Naver Cloud Platform](https://www.ncloud.com/)
- **React/Next.js**: Wrap the Maps API in a custom hook or use `react-naver-maps`
- **API key**: Required env var — typically `NAVER_MAP_CLIENT_ID` and `NAVER_MAP_CLIENT_SECRET`

## Naver Maps API Notes

- API docs: https://navermaps.github.io/maps.js.ncp/docs/
- Client ID is registered at Naver Cloud Platform → Application → Maps
- The script URL format: `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=YOUR_CLIENT_ID`
- Coordinate system: WGS84 (same as Google Maps) — use `naver.maps.LatLng(lat, lng)`
