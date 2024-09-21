<!-- src/App.svelte -->
<script>
    import ServiceForm from './components/ServiceForm.svelte';
    import ServiceList from './components/ServiceList.svelte';

    let services = [
        {
            id: 1,
            name: 'General Consultation',
            description: 'A standard consultation with our healthcare professionals.',
            price: 50
        },
        {
            id: 2,
            name: 'Dental Cleaning',
            description: 'Professional teeth cleaning services.',
            price: 80
        }
    ];

    // Function to add a new service
    function addService(event) { 
        const newService = event.detail;
        newService.id = services.length ? services[services.length - 1].id + 1 : 1;
        services = [...services, newService];
        console.log('Added Service:', newService);
    }

    // Function to update an existing service
    function updateService(event) { 
        const updatedService = event.detail;
        services = services.map(service => 
            service.id === updatedService.id ? updatedService : service
        );
        console.log('Updated Service:', updatedService);
    }

    // Function to delete a service
    function deleteService(event) {
        const id = event.detail; 
        services = services.filter(service => service.id !== id);
        console.log('Deleted Service ID:', id);
    }
</script>

<main>
    <h1>Healthcare Services</h1>
    <ServiceForm on:addService={addService} />
    <ServiceList 
        {services} 
        on:updateService={updateService} 
        on:deleteService={deleteService} 
    />
</main>

<style>
    main {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        font-family: Arial, sans-serif;
    }

    h1 {
        text-align: center;
        color: #2c3e50;
    }
</style>
