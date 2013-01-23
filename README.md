# node-stormwatch

CloudWatch client and metrics gatherer


## Install


     npm install node-stormwatch

## Running

    git clone
    npm install
    node node-stormwatch

## Todo

 * Work templatify into server.js
 * Update data over socket.io every 60 secs
 * How to represent deltas?
 * How to represent new highs?
 * Allow setting "high" on a graph.  Think lke mocha --slow opt.  Approaching high = red, mid = beige/gray, low = light grey. That way color is an indicator of what you should actually be paying attention to.
 * Add support for typing a metric to an AWS alarm to draw the red line
 * Map instance ids to instance names
 * Cache all instance info / describeInstance results.  10 minutes?
 * Annotate anything.  Programatically for deploys.
 * Stacked line of ELB 4XX, 3XX, 5XX, 2XX
 * Draw aggregate of all series
