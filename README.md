# node-stormwatch

CloudWatch client and metrics gatherer


## Install


     npm install node-stormwatch

## Running

    git clone
    npm install
    node node-stormwatch

## Todo

 * Declare graphs with multiple series
 * Declare gauges
 * Support meta metrics (?) How to do show me cpu show all prod web instances?
 * Update data over socket.io every 60 secs
 * How to represent deltas?
 * How to represent new highs?
 * Allow setting "high" on a graph.  Think lke mocha --slow opt.  Approaching high = red, mid = beige/gray, low = light grey. That way color is an indicator of what you should actually be paying attention to.
 * Add support for typing a metric to an AWS alarm to draw the red line
 * Map instance ids to instance names
 * Cache all instance info / describeInstance results
 * Everytime a user commits an action, add them to active monthly and daily sets.  Have weatherman push that to CW so we can see what times people are most active