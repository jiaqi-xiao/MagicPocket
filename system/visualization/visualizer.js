document.addEventListener('DOMContentLoaded', function() {
    const margin = { top: 60, right: 90, bottom: 60, left: 90 };
    const width = 1200 - margin.left - margin.right; // Adjust as needed
    const height = 600 - margin.top - margin.bottom; // Adjust as needed

    const svg = d3.select("#tree-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("#tooltip");

    d3.json("result.json").then(data => {
        // --- Data Transformation for D3 Hierarchy ---
        // Create a map for quick lookup by intent_id
        const dataMap = new Map(data.map(d => [d.intent_id, d]));

        // Create the hierarchical structure
        // We'll create a dummy root if there's no explicit one,
        // or you can define a "root" intent in your JSON if applicable.
        const rootData = {
            intent_id: "root",
            intent_name: "Scenario/Desire",
            intent_description: "Desire in BDI",
            children: []
        };

        data.forEach(d => {
            if (d.parent === null) {
                // Top-level intents
                rootData.children.push(d);
            } else {
                // Child intents
                const parent = dataMap.get(d.parent);
                if (parent) {
                    if (!parent.children) {
                        parent.children = [];
                    }
                    parent.children.push(d);
                } else {
                    console.warn(`Parent with intent_id ${d.parent} not found for intent_id ${d.intent_id}`);
                    // If parent not found, attach to root as a fallback
                    rootData.children.push(d);
                }
            }
        });

        // Use d3.hierarchy to create the hierarchical data structure
        const root = d3.hierarchy(rootData, d => d.children);

        // --- D3 Tree Layout Setup ---
        const treeLayout = d3.tree().size([width, height]); // For a vertical tree

        treeLayout(root);

        // --- Drawing Links ---
        svg.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkVertical() // For vertical tree
                .x(d => d.x)
                .y(d => d.y)
            );

        // --- Drawing Nodes ---
        // >>>>>>> ADJUSTMENT HERE: Define your color scheme based on depths (0, 1, 2, ...) <<<<<<<
        const colorScheme = ['#808080', '#1f77b4', '#ff7f0e', '#2ca02c']; // Example: grey for root (depth 0), then others
        // Or using d3.scaleOrdinal:
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);


        const nodes = svg.selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .on("mouseover", function(event, d) {
                // Show tooltip
                tooltip.html(`
                    <strong>${d.data.intent_name}</strong>
                    ${d.data.intent_description}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px")
                .classed("active", true);
            })
            .on("mouseout", function() {
                // Hide tooltip
                tooltip.classed("active", false);
            });

        nodes.append('circle')
            .attr('r', 10) // Radius of the node circles
            .attr('fill', d => {
                // >>>>>>> ADJUSTMENT HERE: Use d.depth for indexing <<<<<<<
                // Option 1: Using your custom colorScheme array directly by depth
                return colorScheme[d.depth % colorScheme.length]; // Use modulo for repeating colors if more depths exist

                // Option 2: Using the d3.scaleOrdinal (recommended for more automated coloring)
                // return colorScale(d.depth);
            })
            .attr('stroke', d => {
                // >>>>>>> ADJUSTMENT HERE: Use d.depth for indexing for stroke as well <<<<<<<
                // Option 1: For custom colorScheme
                const fillColor = colorScheme[d.depth % colorScheme.length];
                return d3.color(fillColor).darker(0.5);

                // Option 2: For d3.scaleOrdinal
                // return d3.color(colorScale(d.depth)).darker(0.5);
            })
            .attr('stroke-width', 3); // Make sure this is still applied

        nodes.append('text')
            .attr('dy', '0.35em')
            .attr('y', d => d.children ? -20 : 20)
            .attr('text-anchor', 'middle')
            .text(d => d.data.intent_name);

    }).catch(error => {
        console.error("Error loading or processing JSON data:", error);
    });
});