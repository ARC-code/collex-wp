# Collex

This is the plugin for ARC node websites that run entirely off of Wordpress. It allows a Wordpress site to communicate with the ARC catalog as hosted on [Corpora](https://github.com/bptarpley/corpora).

Note: Not to be confused with the legacy Ruby-on-Rails app for ARC nodes. This is a Wordpress plugin intended to enable
scholarly engagement with the ARC Catalog from within an ARC node environment.

## Installing

To install this plugin, clone this repository into the `wp-content/plugins` directory of your Wordpress instance, and
then set the following environment variables:

* `COLLEX_CORPORA_HOST` ie: https://corpora.dh.tamu.edu
* `COLLEX_CORPUS_ID` ie: 5f623b8eff276600a4f44553
* `COLLEX_FEDERATION_ID` ie: 5f62423c52023c009d733904
* `COLLEX_OTHER_FEDERATION_IDS` ie: 5f623f2952023c009d73107f,5f623f9b52023c009d731553,5f623f9552023c009d7314da,5f62423c52023c009d733905

## Wiring Up

To get the ARC Full Search widgets to appear, you must ensure that a page exists in Wordpress containing 3 elements
(preferably &lt;div&gt;'s) with these respective ID's:

* `arc-fs-search-box` The element with this ID will contain the main search box 
* `arc-fs-facets-box` The element with this ID will contain the facet tree
* `arc-fs-results-box` The element with this ID will contain search results
