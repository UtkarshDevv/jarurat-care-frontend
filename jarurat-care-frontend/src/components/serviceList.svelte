<script>
    import ServiceItem from './ServiceItem.svelte';
    export let services = [];

    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    function handleUpdate(event) {
        const updatedService = event.detail;
        dispatch('updateService', updatedService);
        console.log('ServiceList received updateService event:', updatedService);
    }

    function handleDelete(event) {
        const id = event.detail;
        dispatch('deleteService', id);
        console.log('ServiceList received deleteService event for ID:', id);
    }
</script>

<div>
    {#if services.length > 0}
        <ul>
            {#each services as service}
                <ServiceItem 
                    {service} 
                    on:updateService={handleUpdate} 
                    on:deleteService={handleDelete} 
                />
            {/each}
        </ul>
    {:else}
        <p>No services available. Please add a new service.</p>
    {/if}
</div>

<style>
    ul {
        list-style: none;
        padding: 0;
    }
</style>
