<style lang="css" src="../assets/css/packageContainer.css"></style>

<template>
    <div class="packageContainer">
        <div class="packageTitle">
          {{packageContent.packageName}}
        </div>
        <router-link :to="{ name: 'install', params: { packageName: packageContent.packageName, packageId: packageContent.packageId} }">Go to install page</router-link>
        <div class="metricScores">
          <div class="metricScore">
            Bus factor: {{ packageContent.busFactor }}
          </div>
          <div class="metricScore">
            Ramp up: {{ packageContent.rampup }}
          </div>
          <div class="metricScore">
            License: {{ packageContent.license }}
          </div>
          <div class="metricScore">
            Correctness: {{ packageContent.correctness }}
          </div>
          <div class="metricScore">
            Maintainer: {{ packageContent.maintainer }}
          </div>
          <div class="metricScore">
            Pull Request: {{ packageContent.pullRequest }}
          </div>
          <div class="metricScore">
            Pinning: {{ packageContent.pinning }}
          </div>
          <div class="metricScore">
            Total Score: {{ packageContent.score }}
          </div>
        </div>
    </div>
</template>
  
<script>
    export default {
        name: 'packageContainer',
        data() {
            return {
            }
        },
        methods: {
        },
        props: {
            packageContent: Object,
        },
        computed: {
        },
        mounted: function () {
        },
        watch: {
          '$data': {
            handler: function(newValue) {
              console.log(newValue.packageContent)
            },
            deep: true
          }
        }
    }
</script>