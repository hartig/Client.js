# Linked Data Fragments Client <img src="http://linkeddatafragments.org/images/logo.svg" width="100" align="right" alt="" />
On today's Web, Linked Data is published in different ways,
including [data dumps](http://downloads.dbpedia.org/3.9/en/),
[subject pages](http://dbpedia.org/page/Linked_data),
and [results of SPARQL queries](http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org&query=CONSTRUCT+%7B+%3Fp+a+dbpedia-owl%3AArtist+%7D%0D%0AWHERE+%7B+%3Fp+a+dbpedia-owl%3AArtist+%7D&format=text%2Fturtle).
We call each such part a [**Linked Data Fragment**](http://linkeddatafragments.org/) of the dataset.

The issue with the current Linked Data Fragments
is that they are either so powerful that their servers suffer from low availability rates
([as is the case with SPARQL](http://sw.deri.org/~aidanh/docs/epmonitorISWC.pdf)),
or either don't allow efficient querying.

Instead, this client solves queries by accessing **Triple Pattern Fragments**.
<br>
Each Triple Pattern Fragment offers:

- **data** that corresponds to a _triple pattern_
  _([example](http://data.linkeddatafragments.org/dbpedia?subject=&predicate=rdf%3Atype&object=dbpedia-owl%3ARestaurant))_.
- **metadata** that consists of the (approximate) total triple count
  _([example](http://data.linkeddatafragments.org/dbpedia?subject=&predicate=rdf%3Atype&object=))_.
- **controls** that lead to all other fragments of the same dataset
  _([example](http://data.linkeddatafragments.org/dbpedia?subject=&predicate=&object=%22John%22%40en))_.


## Execute SPARQL queries

You can execute SPARQL queries against Triple Pattern Fragments like this:
```bash
$ ldf-client http://fragments.dbpedia.org/2014/en query.sparql
```
The arguments to the `ldf-client` command are:

0. Any fragment of the dataset you want to query, in this case DBpedia.
[_More datasets._](http://linkeddatafragments.org/data/)
0. A file with the query you want to execute (this can also be a string).


### From within your application

First, create a `FragmentsClient` to fetch fragments of a certain dataset.
<br>
Then create a `SparqlIterator` to evaluate SPARQL queries on that dataset.

```JavaScript
var ldf = require('ldf-client');
var fragmentsClient = new ldf.FragmentsClient('http://fragments.dbpedia.org/2014/en');

var query = 'SELECT * { ?s ?p <http://dbpedia.org/resource/Belgium>. ?s ?p ?o } LIMIT 100',
    results = new ldf.SparqlIterator(query, { fragmentsClient: fragmentsClient });
results.on('data', console.log);
```


## Install the client

This client requires [Node.js](http://nodejs.org/) 0.10 or higher
and is tested on OSX and Linux.
To install, execute:
```bash
$ [sudo] npm install -g ldf-client
```

### Browser version

The client can also run in Web browsers via [browserify](https://github.com/substack/node-browserify).
[Live demo.](http://client.linkeddatafragments.org/)

The API is the same as that of the Node version.
<br>
A usage example is available in [a separate project](https://github.com/LinkedDataFragments/WebClient).

### From source
To install from the latest GitHub sources, execute:
```bash
$ git clone git@github.com:LinkedDataFragments/Client.js
$ cd Client.js
$ npm install .
```

Then run the application with:
```bash
$ ./bin/ldf-client http://fragments.dbpedia.org/2014/en queries/artists-york.sparql
```
The `queries` folder contains several example queries for DBpedia.

### Configure HTTPS & WebID

#### SSL Configuration

##### Create a WebID

A WebID is an RDF file that describes the social profile of you or your organization.
It is published under a unique URI, which is used for identification and authentication.

For instance, the WebID of a person called Bob [](https://bob.example.org/profile#me) can look like this:

```
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<> a foaf:PersonalProfileDocument ;
   foaf:maker <#me> ;
   foaf:primaryTopic <#me> .

<#me> a foaf:Person ;
   foaf:name "Bob" ;
   foaf:knows <https://example.edu/p/Alice#MSc> ;
   foaf:img <https://bob.example.org/picture.jpg> .
```

For an organization, the document looks similar as, for instance, [](https://www.w3.org#webid):

```
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<> a foaf:PersonalProfileDocument ;
   foaf:maker <#webid> ;
   foaf:primaryTopic <#webid> .

<#webid> a foaf:Organization ;
   foaf:name "W3C" ;
   foaf:img <https://www.w3.org/2008/site/images/logo-w3c-mobile-lg> .
```

##### Create a client certificate including WebID

First, create a private key to create certificates.

```bash
openssl genrsa \
  -out certs/client/my-app-client.key.pem \
  2048
```

Create a SSL client certificate that includes your WebID in the `subjectAltName`.
Don't forget to correctly fill in the Country (C), Locale (L), Organization (O) and Canonical Name (CN). Also remember to escape (\) the forward slashes in the subjectAltname URI.

```bash
# Create a trusted client cert
# NOTE: You MUST match CN to the domain name or ip address you want to use
openssl req -new \
  -key certs/client/my-app-client.key.pem \
  -out certs/tmp/my-app-client.csr.pem \
  -subj "/C=US/ST=Utah/L=Provo/O=ACME App Client/CN=client.example.net/subjectAltName=uniformResourceIdentifier:https://bob.example.org/profile#me"
```

##### Add your public key to the WebID

Additionally, add your public key to the WebID document. 
```
<#webid> cert:key [ a cert:RSAPublicKey;
                cert:modulus "00cb24ed85d64d794b..."^^xsd:hexBinary;
                cert:exponent 65537 ] .
```

You need the modulus and exponent. To get them, execute the following commands:

modulus:
```bash
openssl rsa -in certs/client/my-app-client.key.pem -modulus -noout
```

exponent:
```bash
openssl rsa -in certs/client/my-app-client.key.pem -text -noout | awk '/Exponent/ { print $2 }'
```


##### Become a trusted peer for the server.

Exchange your certificate request with the server so it can sign it. See the [server documentation](https://github.com/LinkedDataFragments/Server.js/blob/feature-https-authentication/README.md#sign-certificates-from-clients) for more information.

The server should return you the signed certificate, resulting in, for example, `keys/my-app-client.crt.pem`.


#### Configure the client

The client can the be easily configured to use HTTPS in combination with WebID like so. Note that you can add certificates for each data source separately.

```json
{
  "ssl": {
     "https://localhost:8900/testdata": {
        "key": "certs/client/my-app-client.key.pem",
        "cert": "certs/client/my-app-client.crt.pem"
      }
   }
}
```

Make sure your WebID is online so the server is able to download it.

When querying, it is possible that your machine doesn’t accept self-signed certificates, in which case you need to tell it to allow that:
```bash
export NODE_TLS_REJECT_UNAUTHORIZED="0"
```

## License
The Linked Data Fragments client is written by [Ruben Verborgh](http://ruben.verborgh.org/) and colleagues.

This code is copyrighted by [Ghent University – iMinds](http://mmlab.be/)
and released under the [MIT license](http://opensource.org/licenses/MIT).
