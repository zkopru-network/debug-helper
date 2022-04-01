# Zkopru Debug Helper

## Getting Started

1. Clone `Zkopru` via git submodule command on root

    ```bash
    $ git submodule update
    ```

2. Build Zkopru in side submodule folder
  
    ```bash
    $ cd zkopru
    zkopru $ yarn
    zkopru $ yarn build
    ```

3. Back to Debug helper install and build hardhat image for docker container
  
    ```bash
    zkopru $ cd ..
    $ yarn
    ...
    $ yarn build
    ...
    ```

4. Test hardhat node contoller

    ```bash
    $ yarn test
    ```

Create one container and run two hardhat node while testing.3

One is source chain and other is forked chain. The test running on host and interact with forked chain.
