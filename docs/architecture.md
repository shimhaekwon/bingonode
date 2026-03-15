graph TD 
    api -->|File System| fs["File System\n(Static Files)"]

    style frontend fill:#87CEEB,stroke:#000080
    style api fill:#98FB98,stroke:#006400
    style db fill:#FFB6C1,stroke:#FF8C00
    style fs fill:#FFD700,stroke:#FF8C00

    classDef component fill:#FFFFFF,stroke:#000000,stroke-width:2px
    classDef database fill:#FFB6C1,stroke:#FF8C00
    classDef server fill:#98FB98,stroke:#006400
    classDef frontend fill:#87CEEB,stroke:#000080
    classDef storage fill:#FFD700,stroke:#FF8C00

    class frontend frontend
    class server api
    class database db
    class storage fs

    frontend:class frontend
    api:class server
    db:class database
    fs:class storage